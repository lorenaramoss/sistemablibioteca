(() => {
  "use strict";

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const today = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };
  const dateAfter = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };
  const formatDate = (value) => new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  let books = [];
  let loans = [];
  let categories = [];
  let isAuthenticated = false;
  let toastTimer;
  let booksSearchSequence = 0;

  class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  }

  async function api(path, options = {}) {
    let response;
    try {
      response = await fetch(path, {
        ...options,
        credentials: "same-origin",
        headers: {
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...options.headers
        }
      });
    } catch (error) {
      console.error("Falha ao conectar à API da biblioteca.", error);
      throw new ApiError("Não foi possível conectar ao servidor. Verifique se o backend está em execução.", 0);
    }

    if (response.status === 204) return null;
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new ApiError(
        body?.error || body?.detail || body?.title || "O servidor não conseguiu concluir a solicitação.",
        response.status
      );
    }
    return body;
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 3500);
  }

  function handleApiError(error) {
    console.error("A solicitação à API falhou.", error);
    if (error.status === 401) {
      isAuthenticated = false;
      $("#application").hidden = true;
      $("#login-view").hidden = false;
      showToast("Sua sessão expirou. Entre novamente.");
      return;
    }
    showToast(error.message || "Ocorreu um erro ao comunicar com o servidor.");
  }

  function loanStatus(loan) {
    if (loan.returned) return { label: "Devolvido", className: "returned" };
    if (loan.due < today()) return { label: "Em atraso", className: "overdue" };
    return { label: "Em andamento", className: "" };
  }

  async function switchView(view) {
    if (!isAuthenticated) return;
    $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
    const labels = { dashboard: "Visão geral", books: "Acervo", loans: "Empréstimos" };
    $("#page-crumb").textContent = labels[view];
    try {
      if (view === "dashboard") await renderDashboard();
      if (view === "books") await renderBooks();
      if (view === "loans") await renderLoans();
      $("#content").focus({ preventScroll: true });
    } catch (error) {
      handleApiError(error);
    }
  }

  async function showApplication(user) {
    isAuthenticated = true;
    $("#login-view").hidden = true;
    $("#application").hidden = false;
    $(".user-chip strong").textContent = user.name;
    $(".user-chip small").textContent = user.role === "administrador" ? "Administrador" : "Bibliotecário";
    await switchView("dashboard");
  }

  async function loadBooks(search = "") {
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    books = await api(`/api/books${query}`);
    return books;
  }

  async function loadLoans() {
    loans = await api("/api/loans");
    return loans;
  }

  async function renderDashboard() {
    const [loadedBooks, loadedLoans] = await Promise.all([loadBooks(), loadLoans()]);
    const active = loadedLoans.filter((loan) => !loan.returned);
    const overdue = active.filter((loan) => loan.due < today()).length;
    const available = loadedBooks.reduce((total, book) => total + book.availableCopies, 0);
    const recentLoans = [...loadedLoans].sort((a, b) => b.borrowed.localeCompare(a.borrowed)).slice(0, 4);
    const recentBooks = [...loadedBooks].slice(0, 4);
    $("#content").innerHTML = `
      <div class="page-heading"><div><h1>Bom dia, bibliotecário</h1><p>Acompanhe o que acontece na sua biblioteca hoje.</p></div><span class="date-label">${new Date().toLocaleDateString("pt-BR", { dateStyle: "long" })}</span></div>
      <section class="stats-grid" aria-label="Indicadores da biblioteca">
        ${statCard("Títulos no acervo", loadedBooks.length, "▤", "Livros cadastrados")}
        ${statCard("Exemplares disponíveis", available, "◉", "Prontos para emprestar")}
        ${statCard("Empréstimos ativos", active.length, "↗", "Leituras em andamento")}
        ${statCard("Em atraso", overdue, "◷", overdue ? "Precisam de atenção" : "Tudo em dia")}
      </section>
      <div class="dashboard-grid">
        <section class="panel"><div class="panel-heading"><h2>Empréstimos recentes</h2><button class="text-link" data-go="loans">Ver todos →</button></div>
          ${recentLoans.length ? recentLoans.map((loan) => {
            const status = loanStatus(loan);
            return `<div class="loan-row"><span class="loan-avatar">${escapeHtml(loan.reader.charAt(0).toUpperCase())}</span><div class="loan-info"><strong>${escapeHtml(loan.reader)}</strong><small>${escapeHtml(loan.bookTitle)}</small></div><span class="status ${status.className}">${status.label}</span></div>`;
          }).join("") : '<div class="empty-state">Nenhum empréstimo registrado.</div>'}
        </section>
        <section class="panel"><div class="panel-heading"><h2>Acervo</h2><button class="text-link" data-go="books">Ver acervo →</button></div>
          ${recentBooks.length ? recentBooks.map((book, index) => `<div class="book-row"><span class="book-cover cover-${index % 3}">${escapeHtml(book.title.charAt(0))}</span><div class="book-info"><strong>${escapeHtml(book.title)}</strong><small>${escapeHtml(book.author)}</small></div><span class="availability">${book.availableCopies} disp.</span></div>`).join("") : '<div class="empty-state">Nenhum livro cadastrado.</div>'}
        </section>
      </div>`;
    $$("[data-go]", $("#content")).forEach((button) => button.addEventListener("click", () => void switchView(button.dataset.go)));
  }

  function statCard(label, value, icon, foot) {
    return `<article class="stat-card"><div class="stat-top">${label}<span class="stat-icon">${icon}</span></div><div class="stat-number">${value}</div><div class="stat-foot">${foot}</div></article>`;
  }

  async function renderBooks(filter = "") {
    const requestSequence = ++booksSearchSequence;
    const loadedBooks = await loadBooks(filter);
    if (requestSequence !== booksSearchSequence) return;
    $("#content").innerHTML = `
      <div class="page-heading"><div><h1>Acervo</h1><p>Organize os títulos e acompanhe os exemplares disponíveis.</p></div><button class="button button-primary" id="add-book">＋ Cadastrar livro</button></div>
      <section class="table-card"><div class="table-toolbar"><h2 class="table-title">Todos os livros <span class="muted">(${loadedBooks.length})</span></h2><label class="search-box"><span class="search-icon" aria-hidden="true">⌕</span><input id="book-search" type="search" placeholder="Buscar título, autor ou ISBN..." value="${escapeHtml(filter)}" aria-label="Buscar no acervo"></label></div>
        <div class="table-wrap"><table><thead><tr><th>LIVRO</th><th>CATEGORIA</th><th>ISBN</th><th>DISPONIBILIDADE</th><th>EXEMPLARES</th></tr></thead><tbody>
          ${loadedBooks.length ? loadedBooks.map((book) => `<tr><td><strong>${escapeHtml(book.title)}</strong><br><span class="muted">${escapeHtml(book.author)}</span></td><td>${escapeHtml(book.category)}</td><td>${escapeHtml(book.isbn)}</td><td><span class="status ${book.availableCopies ? "" : "overdue"}">${book.availableCopies} disponível(is)</span></td><td>${book.copies}</td></tr>`).join("") : '<tr><td colspan="5" class="empty-state">Nenhum livro encontrado.</td></tr>'}
        </tbody></table></div></section>`;
    $("#add-book").addEventListener("click", () => void openBookModal());
    $("#book-search").addEventListener("input", (event) => {
      const cursor = event.target.selectionStart;
      void renderBooks(event.target.value)
        .then(() => {
          const input = $("#book-search");
          input?.focus();
          input?.setSelectionRange(cursor, cursor);
        })
        .catch(handleApiError);
    });
  }

  async function renderLoans(filter = "all") {
    const loadedLoans = await loadLoans();
    const visibleLoans = [...loadedLoans].sort((a, b) => b.borrowed.localeCompare(a.borrowed))
      .filter((loan) => filter === "all" || (filter === "active" && !loan.returned) || (filter === "returned" && loan.returned));
    $("#content").innerHTML = `
      <div class="page-heading"><div><h1>Empréstimos</h1><p>Registre retiradas e mantenha as devoluções em dia.</p></div><button class="button button-primary" id="add-loan">＋ Novo empréstimo</button></div>
      <section class="table-card"><div class="table-toolbar"><h2 class="table-title">Movimentações <span class="muted">(${visibleLoans.length})</span></h2><label class="search-box"><span class="search-icon" aria-hidden="true">⌕</span><select id="loan-filter" aria-label="Filtrar empréstimos"><option value="all" ${filter === "all" ? "selected" : ""}>Todos os empréstimos</option><option value="active" ${filter === "active" ? "selected" : ""}>Ativos</option><option value="returned" ${filter === "returned" ? "selected" : ""}>Devolvidos</option></select></label></div>
        <div class="table-wrap"><table><thead><tr><th>LEITOR</th><th>LIVRO</th><th>EMPRÉSTIMO</th><th>DEVOLUÇÃO PREVISTA</th><th>SITUAÇÃO</th><th>AÇÃO</th></tr></thead><tbody>
          ${visibleLoans.length ? visibleLoans.map((loan) => {
            const status = loanStatus(loan);
            return `<tr><td><strong>${escapeHtml(loan.reader)}</strong></td><td>${escapeHtml(loan.bookTitle)}</td><td>${formatDate(loan.borrowed)}</td><td>${formatDate(loan.due)}</td><td><span class="status ${status.className}">${status.label}</span></td><td>${loan.returned ? "—" : `<button class="icon-button" data-return="${escapeHtml(loan.id)}">Registrar devolução</button>`}</td></tr>`;
          }).join("") : '<tr><td colspan="6" class="empty-state">Nenhum empréstimo nesta categoria.</td></tr>'}
        </tbody></table></div></section>`;
    $("#add-loan").addEventListener("click", () => void openLoanModal());
    $("#loan-filter").addEventListener("change", (event) => void renderLoans(event.target.value).catch(handleApiError));
    $$("[data-return]", $("#content")).forEach((button) => button.addEventListener("click", () => void returnLoan(button.dataset.return)));
  }

  function showModal(title, description, fields, onSubmit) {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-heading"><div><h2 id="modal-title">${title}</h2><p>${description}</p></div><button class="close-button" type="button" aria-label="Fechar">×</button></div><form class="modal-form">${fields}<p class="form-error full" role="alert" hidden></p><div class="modal-actions"><button class="button button-secondary cancel-modal" type="button">Cancelar</button><button class="button button-primary" type="submit">Salvar</button></div></form></section>`;
    document.body.append(backdrop);
    const close = () => backdrop.remove();
    $(".close-button", backdrop).addEventListener("click", close);
    $(".cancel-modal", backdrop).addEventListener("click", close);
    backdrop.addEventListener("click", (event) => { if (event.target === backdrop) close(); });
    $(".modal-form", backdrop).addEventListener("submit", async (event) => {
      event.preventDefault();
      const submit = $('button[type="submit"]', event.currentTarget);
      const error = $(".form-error", backdrop);
      submit.disabled = true;
      error.hidden = true;
      try {
        await onSubmit(new FormData(event.currentTarget));
        close();
      } catch (requestError) {
        error.textContent = requestError.message;
        error.hidden = false;
      } finally {
        submit.disabled = false;
      }
    });
    $("input,select", backdrop)?.focus();
  }

  async function openBookModal() {
    try {
      categories = await api("/api/categories");
    } catch (error) {
      handleApiError(error);
      return;
    }
    showModal("Cadastrar livro", "Preencha os dados para incluir um título no acervo.", `
      <div class="field full"><label for="book-title">Título *</label><input id="book-title" name="title" required maxlength="200"></div>
      <div class="field full"><label for="book-author">Autor *</label><input id="book-author" name="author" required maxlength="150"></div>
      <div class="field"><label for="book-category">Categoria *</label><select id="book-category" name="category" required>${categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}</select></div>
      <div class="field"><label for="book-isbn">ISBN *</label><input id="book-isbn" name="isbn" required maxlength="20" pattern="[0-9Xx\\-]{10,20}" title="Informe um ISBN-10 ou ISBN-13 válido (números, X ou hífen)."></div>
      <div class="field"><label for="book-copies">Exemplares *</label><input id="book-copies" name="copies" type="number" min="1" step="1" required value="1"></div>`,
    async (formData) => {
      const isbn = String(formData.get("isbn")).replace(/[-\s]/g, "").toUpperCase();
      await api("/api/books", {
        method: "POST",
        body: JSON.stringify({
          title: String(formData.get("title")).trim(),
          author: String(formData.get("author")).trim(),
          category: String(formData.get("category")),
          isbn,
          copies: Number(formData.get("copies"))
        })
      });
      showToast("Livro cadastrado com sucesso.");
      try {
        await renderBooks($("#book-search")?.value || "");
      } catch (error) {
        handleApiError(error);
      }
    });
  }

  async function openLoanModal() {
    try {
      const availableBooks = await loadBooks().then((items) => items.filter((book) => book.availableCopies > 0));
      if (!availableBooks.length) {
        showToast("Não há exemplares disponíveis para empréstimo.");
        return;
      }
      showModal("Novo empréstimo", "Informe os dados do leitor e a previsão de devolução.", `
        <div class="field full"><label for="reader-name">Nome do leitor *</label><input id="reader-name" name="reader" required maxlength="150"></div>
        <div class="field full"><label for="loan-book">Livro *</label><select id="loan-book" name="bookId" required>${availableBooks.map((book) => `<option value="${escapeHtml(book.id)}">${escapeHtml(book.title)} — ${book.availableCopies} disponível(is)</option>`).join("")}</select></div>
        <div class="field full"><label for="loan-due">Devolução prevista *</label><input id="loan-due" name="due" type="date" min="${dateAfter(1)}" value="${dateAfter(14)}" required></div>`,
      async (formData) => {
        await api("/api/loans", {
          method: "POST",
          body: JSON.stringify({
            bookId: String(formData.get("bookId")),
            reader: String(formData.get("reader")).trim(),
            due: String(formData.get("due"))
          })
        });
        showToast("Empréstimo registrado com sucesso.");
        try {
          await renderLoans();
        } catch (error) {
          handleApiError(error);
        }
      });
    } catch (error) {
      handleApiError(error);
    }
  }

  async function returnLoan(id) {
    try {
      await api(`/api/loans/${encodeURIComponent(id)}/return`, { method: "POST" });
      showToast("Devolução registrada. Exemplar disponível no acervo.");
      await renderLoans($("#loan-filter")?.value || "all");
    } catch (error) {
      handleApiError(error);
    }
  }

  $("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = $('button[type="submit"]', event.currentTarget);
    const errorMessage = $("#login-error");
    errorMessage.hidden = true;
    submit.disabled = true;
    const form = new FormData(event.currentTarget);
    try {
      const user = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: String(form.get("username")).trim(),
          password: String(form.get("password"))
        })
      });
      await showApplication(user);
    } catch (error) {
      if (error.status === 401 || error.status === 429) {
        errorMessage.textContent = error.status === 429
          ? "Muitas tentativas de acesso. Aguarde um minuto e tente novamente."
          : error.message;
        errorMessage.hidden = false;
        $("#password").select();
      } else {
        handleApiError(error);
      }
    } finally {
      submit.disabled = false;
    }
  });

  $$(".nav-item").forEach((item) => item.addEventListener("click", () => void switchView(item.dataset.view)));
  $$(".brand[data-view]").forEach((item) => item.addEventListener("click", (event) => {
    event.preventDefault();
    void switchView(item.dataset.view);
  }));
  $("#logout-button").addEventListener("click", async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
      isAuthenticated = false;
      $("#application").hidden = true;
      $("#login-view").hidden = false;
      $("#login-form").reset();
    } catch (error) {
      handleApiError(error);
    }
  });

  api("/api/auth/me")
    .then((user) => showApplication(user))
    .catch((error) => {
      if (error.status !== 401) handleApiError(error);
    });
})();

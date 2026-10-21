(() => {
  "use strict";

  const STORAGE_KEY = "biblioteca-horizonte-v1";
  const DEMO_USER = "bibliotecario";
  const DEMO_PASSWORD = "Leitura123!";
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const today = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const dateAfter = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const formatDate = (value) => new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  const seed = {
    books: [
      { id: "b1", title: "Dom Casmurro", author: "Machado de Assis", category: "Literatura", isbn: "9788535910663", copies: 4 },
      { id: "b2", title: "O Pequeno Príncipe", author: "Antoine de Saint-Exupéry", category: "Literatura", isbn: "9788522031438", copies: 5 },
      { id: "b3", title: "O Povo Brasileiro", author: "Darcy Ribeiro", category: "História", isbn: "9788526022256", copies: 2 },
      { id: "b4", title: "Pedagogia da Autonomia", author: "Paulo Freire", category: "Educação", isbn: "9788577531639", copies: 3 },
      { id: "b5", title: "Use a Cabeça! Java", author: "Kathy Sierra e Bert Bates", category: "Tecnologia", isbn: "9788576081739", copies: 3 }
    ],
    loans: [
      { id: "l1", bookId: "b1", reader: "Ana Souza", borrowed: dateAfter(-2), due: dateAfter(12), returned: null },
      { id: "l2", bookId: "b3", reader: "Rafael Lima", borrowed: dateAfter(-17), due: dateAfter(-3), returned: null },
      { id: "l3", bookId: "b2", reader: "Mariana Costa", borrowed: dateAfter(-21), due: dateAfter(-7), returned: dateAfter(-8) }
    ]
  };
  let data;
  let toastTimer;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    data = stored ? JSON.parse(stored) : structuredClone(seed);
    if (!Array.isArray(data.books) || !Array.isArray(data.loans)) throw new Error("Dados locais inválidos.");
  } catch (error) {
    console.error("Não foi possível carregar os dados da biblioteca.", error);
    data = structuredClone(seed);
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error("Não foi possível salvar os dados da biblioteca.", error);
      return false;
    }
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 2800);
  }

  function activeLoans(bookId) {
    return data.loans.filter((loan) => loan.bookId === bookId && !loan.returned).length;
  }

  function availableCopies(book) {
    return Math.max(0, book.copies - activeLoans(book.id));
  }

  function bookById(id) {
    return data.books.find((book) => book.id === id);
  }

  function loanStatus(loan) {
    if (loan.returned) return { label: "Devolvido", className: "returned" };
    if (loan.due < today()) return { label: "Em atraso", className: "overdue" };
    return { label: "Em andamento", className: "" };
  }

  function switchView(view) {
    if (!sessionStorage.getItem("biblioteca-authenticated")) return;
    $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
    const labels = { dashboard: "Visão geral", books: "Acervo", loans: "Empréstimos" };
    $("#page-crumb").textContent = labels[view];
    if (view === "dashboard") renderDashboard();
    if (view === "books") renderBooks();
    if (view === "loans") renderLoans();
    $("#content").focus({ preventScroll: true });
  }

  function showApplication(view = "dashboard") {
    $("#login-view").hidden = true;
    $("#application").hidden = false;
    switchView(view);
  }

  function renderDashboard() {
    const active = data.loans.filter((loan) => !loan.returned);
    const overdue = active.filter((loan) => loan.due < today()).length;
    const available = data.books.reduce((total, book) => total + availableCopies(book), 0);
    const recentLoans = [...data.loans].sort((a, b) => b.borrowed.localeCompare(a.borrowed)).slice(0, 4);
    const recentBooks = [...data.books].slice(-4).reverse();
    $("#content").innerHTML = `
      <div class="page-heading"><div><h1>Bom dia, bibliotecário</h1><p>Acompanhe o que acontece na sua biblioteca hoje.</p></div><span class="date-label">${new Date().toLocaleDateString("pt-BR", { dateStyle: "long" })}</span></div>
      <section class="stats-grid" aria-label="Indicadores da biblioteca">
        ${statCard("Títulos no acervo", data.books.length, "▤", "Livros cadastrados")}
        ${statCard("Exemplares disponíveis", available, "◉", "Prontos para emprestar")}
        ${statCard("Empréstimos ativos", active.length, "↗", "Leituras em andamento")}
        ${statCard("Em atraso", overdue, "◷", overdue ? "Precisam de atenção" : "Tudo em dia")}
      </section>
      <div class="dashboard-grid">
        <section class="panel"><div class="panel-heading"><h2>Empréstimos recentes</h2><button class="text-link" data-go="loans">Ver todos →</button></div>
          ${recentLoans.length ? recentLoans.map((loan) => {
            const book = bookById(loan.bookId);
            const status = loanStatus(loan);
            return `<div class="loan-row"><span class="loan-avatar">${escapeHtml(loan.reader.charAt(0).toUpperCase())}</span><div class="loan-info"><strong>${escapeHtml(loan.reader)}</strong><small>${escapeHtml(book?.title || "Livro removido")}</small></div><span class="status ${status.className}">${status.label}</span></div>`;
          }).join("") : '<div class="empty-state">Nenhum empréstimo registrado.</div>'}
        </section>
        <section class="panel"><div class="panel-heading"><h2>Adicionados recentemente</h2><button class="text-link" data-go="books">Ver acervo →</button></div>
          ${recentBooks.length ? recentBooks.map((book, index) => `<div class="book-row"><span class="book-cover cover-${index % 3}">${escapeHtml(book.title.charAt(0))}</span><div class="book-info"><strong>${escapeHtml(book.title)}</strong><small>${escapeHtml(book.author)}</small></div><span class="availability">${availableCopies(book)} disp.</span></div>`).join("") : '<div class="empty-state">Nenhum livro cadastrado.</div>'}
        </section>
      </div>`;
    $$("[data-go]", $("#content")).forEach((button) => button.addEventListener("click", () => switchView(button.dataset.go)));
  }

  function statCard(label, value, icon, foot) {
    return `<article class="stat-card"><div class="stat-top">${label}<span class="stat-icon">${icon}</span></div><div class="stat-number">${value}</div><div class="stat-foot">${foot}</div></article>`;
  }

  function renderBooks(filter = "") {
    const needle = filter.trim().toLocaleLowerCase("pt-BR");
    const books = data.books.filter((book) => [book.title, book.author, book.category, book.isbn].some((value) => value.toLocaleLowerCase("pt-BR").includes(needle)));
    $("#content").innerHTML = `
      <div class="page-heading"><div><h1>Acervo</h1><p>Organize os títulos e acompanhe os exemplares disponíveis.</p></div><button class="button button-primary" id="add-book">＋ Cadastrar livro</button></div>
      <section class="table-card"><div class="table-toolbar"><h2 class="table-title">Todos os livros <span class="muted">(${books.length})</span></h2><label class="search-box"><span class="search-icon" aria-hidden="true">⌕</span><input id="book-search" type="search" placeholder="Buscar título, autor ou ISBN..." value="${escapeHtml(filter)}" aria-label="Buscar no acervo"></label></div>
        <div class="table-wrap"><table><thead><tr><th>LIVRO</th><th>CATEGORIA</th><th>ISBN</th><th>DISPONIBILIDADE</th><th>EXEMPLARES</th></tr></thead><tbody>
          ${books.length ? books.map((book) => `<tr><td><strong>${escapeHtml(book.title)}</strong><br><span class="muted">${escapeHtml(book.author)}</span></td><td>${escapeHtml(book.category)}</td><td>${escapeHtml(book.isbn)}</td><td><span class="status ${availableCopies(book) ? "" : "overdue"}">${availableCopies(book)} disponível(is)</span></td><td>${book.copies}</td></tr>`).join("") : '<tr><td colspan="5" class="empty-state">Nenhum livro encontrado.</td></tr>'}
        </tbody></table></div></section>`;
    $("#add-book").addEventListener("click", () => openBookModal());
    $("#book-search").addEventListener("input", (event) => {
      const cursor = event.target.selectionStart;
      renderBooks(event.target.value);
      const input = $("#book-search");
      input.focus();
      input.setSelectionRange(cursor, cursor);
    });
  }

  function renderLoans(filter = "all") {
    const loans = [...data.loans].sort((a, b) => b.borrowed.localeCompare(a.borrowed))
      .filter((loan) => filter === "all" || (filter === "active" && !loan.returned) || (filter === "returned" && loan.returned));
    $("#content").innerHTML = `
      <div class="page-heading"><div><h1>Empréstimos</h1><p>Registre retiradas e mantenha as devoluções em dia.</p></div><button class="button button-primary" id="add-loan">＋ Novo empréstimo</button></div>
      <section class="table-card"><div class="table-toolbar"><h2 class="table-title">Movimentações <span class="muted">(${loans.length})</span></h2><label class="search-box"><span class="search-icon" aria-hidden="true">⌕</span><select id="loan-filter" aria-label="Filtrar empréstimos"><option value="all" ${filter === "all" ? "selected" : ""}>Todos os empréstimos</option><option value="active" ${filter === "active" ? "selected" : ""}>Ativos</option><option value="returned" ${filter === "returned" ? "selected" : ""}>Devolvidos</option></select></label></div>
        <div class="table-wrap"><table><thead><tr><th>LEITOR</th><th>LIVRO</th><th>EMPRÉSTIMO</th><th>DEVOLUÇÃO PREVISTA</th><th>SITUAÇÃO</th><th>AÇÃO</th></tr></thead><tbody>
          ${loans.length ? loans.map((loan) => {
            const status = loanStatus(loan);
            const book = bookById(loan.bookId);
            return `<tr><td><strong>${escapeHtml(loan.reader)}</strong></td><td>${escapeHtml(book?.title || "Livro removido")}</td><td>${formatDate(loan.borrowed)}</td><td>${formatDate(loan.due)}</td><td><span class="status ${status.className}">${status.label}</span></td><td>${loan.returned ? "—" : `<button class="icon-button" data-return="${escapeHtml(loan.id)}">Registrar devolução</button>`}</td></tr>`;
          }).join("") : '<tr><td colspan="6" class="empty-state">Nenhum empréstimo nesta categoria.</td></tr>'}
        </tbody></table></div></section>`;
    $("#add-loan").addEventListener("click", () => openLoanModal());
    $("#loan-filter").addEventListener("change", (event) => renderLoans(event.target.value));
    $$("[data-return]", $("#content")).forEach((button) => button.addEventListener("click", () => returnLoan(button.dataset.return)));
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
    $(".modal-form", backdrop).addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const result = onSubmit(formData);
      if (result) {
        $(".form-error", backdrop).textContent = result;
        $(".form-error", backdrop).hidden = false;
      } else {
        close();
      }
    });
    $("input,select", backdrop)?.focus();
  }

  function openBookModal() {
    const categories = ["Literatura", "Tecnologia", "História", "Educação", "Outra"];
    showModal("Cadastrar livro", "Preencha os dados para incluir um título no acervo.", `
      <div class="field full"><label for="book-title">Título *</label><input id="book-title" name="title" required maxlength="200"></div>
      <div class="field full"><label for="book-author">Autor *</label><input id="book-author" name="author" required maxlength="150"></div>
      <div class="field"><label for="book-category">Categoria *</label><select id="book-category" name="category" required>${categories.map((category) => `<option>${category}</option>`).join("")}</select></div>
      <div class="field"><label for="book-isbn">ISBN *</label><input id="book-isbn" name="isbn" required maxlength="20" pattern="[0-9Xx\\-]{10,20}" title="Informe um ISBN de 10 a 20 caracteres (números, X ou hífen)."></div>
      <div class="field"><label for="book-copies">Exemplares *</label><input id="book-copies" name="copies" type="number" min="1" step="1" required value="1"></div>`,
    (formData) => {
      const isbn = String(formData.get("isbn")).replace(/[-\s]/g, "").toUpperCase();
      if (data.books.some((book) => book.isbn.replace(/[-\s]/g, "").toUpperCase() === isbn)) return "Este ISBN já está cadastrado.";
      data.books.push({
        id: `b${Date.now()}`, title: String(formData.get("title")).trim(),
        author: String(formData.get("author")).trim(), category: String(formData.get("category")),
        isbn, copies: Number(formData.get("copies"))
      });
      if (!save()) {
        data.books.pop();
        return "Não foi possível salvar os dados neste navegador.";
      }
      renderBooks($("#book-search")?.value || "");
      showToast("Livro cadastrado com sucesso.");
      return "";
    });
  }

  function openLoanModal() {
    const availableBooks = data.books.filter((book) => availableCopies(book) > 0);
    if (!availableBooks.length) {
      showToast("Não há exemplares disponíveis para empréstimo.");
      return;
    }
    showModal("Novo empréstimo", "Informe os dados do leitor e a previsão de devolução.", `
      <div class="field full"><label for="reader-name">Nome do leitor *</label><input id="reader-name" name="reader" required maxlength="150"></div>
      <div class="field full"><label for="loan-book">Livro *</label><select id="loan-book" name="bookId" required>${availableBooks.map((book) => `<option value="${escapeHtml(book.id)}">${escapeHtml(book.title)} — ${availableCopies(book)} disponível(is)</option>`).join("")}</select></div>
      <div class="field full"><label for="loan-due">Devolução prevista *</label><input id="loan-due" name="due" type="date" min="${dateAfter(1)}" value="${dateAfter(14)}" required></div>`,
    (formData) => {
      const book = bookById(String(formData.get("bookId")));
      if (!book || availableCopies(book) < 1) return "Este livro não possui exemplar disponível.";
      const due = String(formData.get("due"));
      if (!due || due <= today()) return "A data de devolução deve ser posterior à data de hoje.";
      data.loans.push({
        id: `l${Date.now()}`, bookId: book.id, reader: String(formData.get("reader")).trim(),
        borrowed: today(), due, returned: null
      });
      if (!save()) {
        data.loans.pop();
        return "Não foi possível salvar os dados neste navegador.";
      }
      renderLoans();
      showToast("Empréstimo registrado com sucesso.");
      return "";
    });
  }

  function returnLoan(id) {
    const loan = data.loans.find((item) => item.id === id);
    if (!loan || loan.returned) {
      showToast("Este empréstimo já foi devolvido.");
      return;
    }
    loan.returned = today();
    if (!save()) {
      loan.returned = null;
      showToast("Não foi possível salvar a devolução neste navegador.");
      return;
    }
    renderLoans($("#loan-filter")?.value || "all");
    showToast("Devolução registrada. Exemplar disponível no acervo.");
  }

  $("#login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("username") === DEMO_USER && form.get("password") === DEMO_PASSWORD) {
      sessionStorage.setItem("biblioteca-authenticated", "true");
      $("#login-error").hidden = true;
      showApplication();
    } else {
      $("#login-error").textContent = "Usuário ou senha inválidos. Verifique seus dados e tente novamente.";
      $("#login-error").hidden = false;
      $("#password").select();
    }
  });

  $$(".nav-item").forEach((item) => item.addEventListener("click", () => switchView(item.dataset.view)));
  $$(".brand[data-view]").forEach((item) => item.addEventListener("click", (event) => {
    event.preventDefault();
    switchView(item.dataset.view);
  }));
  $("#logout-button").addEventListener("click", () => {
    sessionStorage.removeItem("biblioteca-authenticated");
    $("#application").hidden = true;
    $("#login-view").hidden = false;
    $("#login-form").reset();
  });

  if (sessionStorage.getItem("biblioteca-authenticated")) showApplication();
})();

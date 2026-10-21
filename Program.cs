using System.Data;
using System.Text.RegularExpressions;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Npgsql;
using NpgsqlTypes;

var builder = WebApplication.CreateBuilder(args);
var connectionString = builder.Configuration["BIBLIOTECA_DB"]
    ?? builder.Configuration.GetConnectionString("Biblioteca");

if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "Configure a variável BIBLIOTECA_DB com a connection string do PostgreSQL.");
}

builder.Services.AddSingleton(NpgsqlDataSource.Create(connectionString));
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(options =>
{
    options.Cookie.Name = "biblioteca.session";
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest
        : CookieSecurePolicy.Always;
    options.IdleTimeout = TimeSpan.FromMinutes(30);
});
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("login", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                AutoReplenishment = true,
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1)
            }));
});
builder.Services.AddProblemDetails();

var app = builder.Build();

app.UseExceptionHandler();
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.UseHttpsRedirection();
}
app.UseRouting();
app.UseRateLimiter();
app.UseSession();
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/api/health", async (NpgsqlDataSource database, CancellationToken cancellationToken) =>
{
    await using var connection = await database.OpenConnectionAsync(cancellationToken);
    await using var command = new NpgsqlCommand("SELECT 1", connection);
    await command.ExecuteScalarAsync(cancellationToken);
    return Results.Ok(new { status = "ok" });
});

app.MapPost("/api/auth/login", async (
    HttpContext context,
    LoginRequest? request,
    NpgsqlDataSource database,
    CancellationToken cancellationToken) =>
{
    if (request is null ||
        string.IsNullOrWhiteSpace(request.Username) ||
        string.IsNullOrWhiteSpace(request.Password))
    {
        return Results.Problem(
            title: "Informe usuário e senha.",
            statusCode: StatusCodes.Status400BadRequest);
    }

    await using var connection = await database.OpenConnectionAsync(cancellationToken);
    const string sql = """
        SELECT id, nome, perfil
        FROM usuarios
        WHERE ativo
          AND (
              lower(email) = lower(@Username)
              OR lower(split_part(email, '@', 1)) = lower(@Username)
          )
          AND senha_hash = crypt(@Password, senha_hash)
        LIMIT 1;
        """;
    await using var command = new NpgsqlCommand(sql, connection);
    command.Parameters.AddWithValue("Username", request.Username.Trim());
    command.Parameters.AddWithValue("Password", request.Password);
    await using var reader = await command.ExecuteReaderAsync(cancellationToken);

    if (!await reader.ReadAsync(cancellationToken))
    {
        return Results.Problem(
            title: "Usuário ou senha inválidos.",
            statusCode: StatusCodes.Status401Unauthorized);
    }

    var user = new AuthResponse(reader.GetInt64(0).ToString(), reader.GetString(1), reader.GetString(2));
    await reader.CloseAsync();
    await context.Session.LoadAsync(cancellationToken);
    context.Session.SetString("userId", user.Id);
    context.Session.SetString("userName", user.Name);
    context.Session.SetString("userRole", user.Role);
    await context.Session.CommitAsync(cancellationToken);

    return Results.Ok(user);
}).RequireRateLimiting("login");

app.MapGet("/api/auth/me", (HttpContext context) =>
{
    if (!TryGetUser(context, out var userId))
    {
        return Results.Unauthorized();
    }

    return Results.Ok(new AuthResponse(
        userId.ToString(),
        context.Session.GetString("userName") ?? "Bibliotecário",
        context.Session.GetString("userRole") ?? "bibliotecario"));
});

app.MapPost("/api/auth/logout", async (HttpContext context, CancellationToken cancellationToken) =>
{
    if (!TryGetUser(context, out _))
    {
        return Results.Unauthorized();
    }

    await context.Session.LoadAsync(cancellationToken);
    context.Session.Clear();
    await context.Session.CommitAsync(cancellationToken);
    return Results.NoContent();
});

app.MapGet("/api/categories", async (
    HttpContext context,
    NpgsqlDataSource database,
    CancellationToken cancellationToken) =>
{
    if (!TryGetUser(context, out _))
    {
        return Results.Unauthorized();
    }

    await using var connection = await database.OpenConnectionAsync(cancellationToken);
    await using var command = new NpgsqlCommand("SELECT nome FROM categorias ORDER BY nome", connection);
    await using var reader = await command.ExecuteReaderAsync(cancellationToken);
    var categories = new List<string>();
    while (await reader.ReadAsync(cancellationToken))
    {
        categories.Add(reader.GetString(0));
    }

    return Results.Ok(categories);
});

app.MapGet("/api/books", async (
    HttpContext context,
    NpgsqlDataSource database,
    string? search,
    CancellationToken cancellationToken) =>
{
    if (!TryGetUser(context, out _))
    {
        return Results.Unauthorized();
    }

    await using var connection = await database.OpenConnectionAsync(cancellationToken);
    const string sql = """
        SELECT livro_id, titulo, autor, categoria, isbn, exemplares_totais, exemplares_disponiveis
        FROM vw_livros_disponibilidade
        WHERE @Search = ''
           OR titulo ILIKE '%' || @Search || '%'
           OR autor ILIKE '%' || @Search || '%'
           OR categoria ILIKE '%' || @Search || '%'
           OR isbn ILIKE '%' || @Search || '%'
        ORDER BY titulo;
        """;
    await using var command = new NpgsqlCommand(sql, connection);
    command.Parameters.AddWithValue("Search", search?.Trim() ?? string.Empty);
    await using var reader = await command.ExecuteReaderAsync(cancellationToken);
    var books = new List<BookResponse>();
    while (await reader.ReadAsync(cancellationToken))
    {
        books.Add(new BookResponse(
            reader.GetInt64(0).ToString(),
            reader.GetString(1),
            reader.GetString(2),
            reader.GetString(3),
            reader.GetString(4),
            reader.GetInt32(5),
            reader.GetInt32(6)));
    }

    return Results.Ok(books);
});

app.MapPost("/api/books", async (
    HttpContext context,
    BookRequest? request,
    NpgsqlDataSource database,
    CancellationToken cancellationToken) =>
{
    if (!TryGetUser(context, out _))
    {
        return Results.Unauthorized();
    }

    var validationError = ValidateBook(request);
    if (validationError is not null)
    {
        return Results.Problem(title: validationError, statusCode: StatusCodes.Status400BadRequest);
    }

    var book = request!;
    var normalizedIsbn = NormalizeIsbn(book.Isbn);
    await using var connection = await database.OpenConnectionAsync(cancellationToken);
    await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

    await using (var duplicateCommand = new NpgsqlCommand(
        """
        SELECT EXISTS (
            SELECT 1
            FROM livros
            WHERE regexp_replace(upper(isbn), '[^0-9X]', '', 'g') = @Isbn
        );
        """,
        connection,
        transaction))
    {
        duplicateCommand.Parameters.AddWithValue("Isbn", normalizedIsbn);
        if ((bool)(await duplicateCommand.ExecuteScalarAsync(cancellationToken) ?? false))
        {
            return Results.Conflict(new { error = "Este ISBN já está cadastrado." });
        }
    }

    await using var command = new NpgsqlCommand(
        """
        INSERT INTO livros (categoria_id, titulo, autor, isbn, exemplares_totais)
        SELECT id, @Title, @Author, @Isbn, @Copies
        FROM categorias
        WHERE nome = @Category
        RETURNING id;
        """,
        connection,
        transaction);
    command.Parameters.AddWithValue("Title", book.Title.Trim());
    command.Parameters.AddWithValue("Author", book.Author.Trim());
    command.Parameters.AddWithValue("Isbn", normalizedIsbn);
    command.Parameters.AddWithValue("Copies", book.Copies);
    command.Parameters.AddWithValue("Category", book.Category.Trim());

    try
    {
        var id = await command.ExecuteScalarAsync(cancellationToken);
        if (id is null)
        {
            return Results.Problem(
                title: "A categoria selecionada não existe.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        await transaction.CommitAsync(cancellationToken);
        return Results.Created($"/api/books/{id}", new { id = Convert.ToInt64(id).ToString() });
    }
    catch (PostgresException exception) when (exception.SqlState == PostgresErrorCodes.UniqueViolation)
    {
        return Results.Conflict(new { error = "Este ISBN já está cadastrado." });
    }
});

app.MapGet("/api/loans", async (
    HttpContext context,
    NpgsqlDataSource database,
    string? status,
    CancellationToken cancellationToken) =>
{
    if (!TryGetUser(context, out _))
    {
        return Results.Unauthorized();
    }

    if (status is not null && status is not ("ativo" or "devolvido"))
    {
        return Results.Problem(
            title: "O filtro deve ser 'ativo' ou 'devolvido'.",
            statusCode: StatusCodes.Status400BadRequest);
    }

    await using var connection = await database.OpenConnectionAsync(cancellationToken);
    const string sql = """
        SELECT e.id, e.livro_id, l.titulo, e.leitor_nome,
               e.data_emprestimo::text, e.data_prevista_devolucao::text,
               e.data_devolucao::text, e.status
        FROM emprestimos e
        JOIN livros l ON l.id = e.livro_id
        WHERE @Status IS NULL OR e.status = @Status
        ORDER BY e.data_emprestimo DESC, e.id DESC;
        """;
    await using var command = new NpgsqlCommand(sql, connection);
    command.Parameters.Add("Status", NpgsqlDbType.Text).Value = (object?)status ?? DBNull.Value;
    await using var reader = await command.ExecuteReaderAsync(cancellationToken);
    var loans = new List<LoanResponse>();
    while (await reader.ReadAsync(cancellationToken))
    {
        loans.Add(new LoanResponse(
            reader.GetInt64(0).ToString(),
            reader.GetInt64(1).ToString(),
            reader.GetString(2),
            reader.GetString(3),
            reader.GetString(4),
            reader.GetString(5),
            reader.IsDBNull(6) ? null : reader.GetString(6),
            reader.GetString(7)));
    }

    return Results.Ok(loans);
});

app.MapPost("/api/loans", async (
    HttpContext context,
    LoanRequest? request,
    NpgsqlDataSource database,
    CancellationToken cancellationToken) =>
{
    if (!TryGetUser(context, out var userId))
    {
        return Results.Unauthorized();
    }

    if (request is null ||
        !long.TryParse(request.BookId, out var bookId) ||
        string.IsNullOrWhiteSpace(request.Reader) ||
        request.Reader.Trim().Length > 150)
    {
        return Results.Problem(
            title: "Informe um livro, o nome do leitor e uma data futura para devolução.",
            statusCode: StatusCodes.Status400BadRequest);
    }

    await using var connection = await database.OpenConnectionAsync(cancellationToken);
    await using var transaction = await connection.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);
    await using (var dateCommand = new NpgsqlCommand("SELECT CURRENT_DATE", connection, transaction))
    {
        var databaseDate = await dateCommand.ExecuteScalarAsync(cancellationToken);
        if (request!.Due <= (DateOnly)databaseDate!)
        {
            return Results.Problem(
                title: "A data de devolução deve ser posterior à data de hoje.",
                statusCode: StatusCodes.Status400BadRequest);
        }
    }

    int totalCopies;
    await using (var bookCommand = new NpgsqlCommand(
        "SELECT exemplares_totais FROM livros WHERE id = @BookId FOR UPDATE",
        connection,
        transaction))
    {
        bookCommand.Parameters.AddWithValue("BookId", bookId);
        var result = await bookCommand.ExecuteScalarAsync(cancellationToken);
        if (result is null)
        {
            return Results.NotFound(new { error = "O livro selecionado não foi encontrado." });
        }

        totalCopies = Convert.ToInt32(result);
    }

    await using (var countCommand = new NpgsqlCommand(
        "SELECT COUNT(*) FROM emprestimos WHERE livro_id = @BookId AND status = 'ativo'",
        connection,
        transaction))
    {
        countCommand.Parameters.AddWithValue("BookId", bookId);
        var borrowedCopies = Convert.ToInt32(await countCommand.ExecuteScalarAsync(cancellationToken));
        if (borrowedCopies >= totalCopies)
        {
            return Results.Conflict(new { error = "Não há exemplares disponíveis deste livro." });
        }
    }

    await using var insertCommand = new NpgsqlCommand(
        """
        INSERT INTO emprestimos (
            livro_id, usuario_id, leitor_nome, data_emprestimo, data_prevista_devolucao
        )
        VALUES (@BookId, @UserId, @Reader, CURRENT_DATE, @Due)
        RETURNING id;
        """,
        connection,
        transaction);
    insertCommand.Parameters.AddWithValue("BookId", bookId);
    insertCommand.Parameters.AddWithValue("UserId", userId);
    insertCommand.Parameters.AddWithValue("Reader", request.Reader.Trim());
    insertCommand.Parameters.Add("Due", NpgsqlDbType.Date).Value = request.Due;
    var loanId = Convert.ToInt64(await insertCommand.ExecuteScalarAsync(cancellationToken));
    await transaction.CommitAsync(cancellationToken);

    return Results.Created($"/api/loans/{loanId}", new { id = loanId.ToString() });
});

app.MapPost("/api/loans/{id}/return", async (
    HttpContext context,
    string id,
    NpgsqlDataSource database,
    CancellationToken cancellationToken) =>
{
    if (!TryGetUser(context, out _))
    {
        return Results.Unauthorized();
    }

    if (!long.TryParse(id, out var loanId) || loanId <= 0)
    {
        return Results.Problem(
            title: "O identificador do empréstimo é inválido.",
            statusCode: StatusCodes.Status400BadRequest);
    }

    await using var connection = await database.OpenConnectionAsync(cancellationToken);
    const string sql = """
        UPDATE emprestimos
        SET status = 'devolvido', data_devolucao = CURRENT_DATE
        WHERE id = @Id AND status = 'ativo' AND data_devolucao IS NULL
        RETURNING id;
        """;
    await using var command = new NpgsqlCommand(sql, connection);
    command.Parameters.AddWithValue("Id", loanId);
    var updatedId = await command.ExecuteScalarAsync(cancellationToken);
    if (updatedId is null)
    {
        await using var existsCommand = new NpgsqlCommand(
            "SELECT EXISTS (SELECT 1 FROM emprestimos WHERE id = @Id)",
            connection);
        existsCommand.Parameters.AddWithValue("Id", loanId);
        var exists = (bool)(await existsCommand.ExecuteScalarAsync(cancellationToken) ?? false);
        return exists
            ? Results.Conflict(new { error = "Este empréstimo já foi devolvido." })
            : Results.NotFound(new { error = "O empréstimo não foi encontrado." });
    }

    return Results.Ok(new { id = Convert.ToInt64(updatedId).ToString(), returned = true });
});

app.Run();

static bool TryGetUser(HttpContext context, out long userId)
{
    userId = 0;
    return long.TryParse(context.Session.GetString("userId"), out userId);
}

static string? ValidateBook(BookRequest? request)
{
    if (request is null ||
        string.IsNullOrWhiteSpace(request.Title) ||
        request.Title.Trim().Length > 200 ||
        string.IsNullOrWhiteSpace(request.Author) ||
        request.Author.Trim().Length > 150 ||
        string.IsNullOrWhiteSpace(request.Category) ||
        request.Category.Trim().Length > 100 ||
        string.IsNullOrWhiteSpace(request.Isbn) ||
        request.Isbn.Length > 20 ||
        !Regex.IsMatch(request.Isbn, "^[0-9Xx-]{10,20}$") ||
        !Regex.IsMatch(NormalizeIsbn(request.Isbn), "^(?:[0-9]{9}[0-9X]|[0-9]{13})$") ||
        request.Copies <= 0)
    {
        return "Informe título, autor, categoria, ISBN válido e quantidade de exemplares maior que zero.";
    }

    return null;
}

static string NormalizeIsbn(string isbn) =>
    Regex.Replace(isbn, "[^0-9X]", string.Empty, RegexOptions.IgnoreCase).ToUpperInvariant();

internal sealed record LoginRequest(string Username, string Password);
internal sealed record BookRequest(string Title, string Author, string Category, string Isbn, int Copies);
internal sealed record LoanRequest(string BookId, string Reader, DateOnly Due);
internal sealed record AuthResponse(string Id, string Name, string Role);
internal sealed record BookResponse(
    string Id,
    string Title,
    string Author,
    string Category,
    string Isbn,
    int Copies,
    int AvailableCopies);
internal sealed record LoanResponse(
    string Id,
    string BookId,
    string BookTitle,
    string Reader,
    string Borrowed,
    string Due,
    string? Returned,
    string Status);

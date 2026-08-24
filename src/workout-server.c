/* workout_server.c

 Minimal HTTP server for a single-user workout log.
 GET  /  -> returns the current data file
 PUT  /  -> replaces the data file (atomic write, one rotated backup)

 No dependencies beyond libc. Single blocking accept() loop -- this is
 a single-connection app, so there is nothing that needs to be concurrent.
 If a second request arrives while one is in flight, the kernel just
 queues it in the listen backlog until this loop comes back around.
*/

/*
> [!WARNING]
> ⚠️ **AI-gerenated Code:**
*/

#define _GNU_SOURCE

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <unistd.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>

#ifdef DEBUG
#  define assert(expression) ({ if (!(expression)) __builtin_trap(); })
#else
#  define assert(...)
#endif // DEBUG

#define LISTEN_PORT     8081
// #define DATA_PATH       "/home/pi/workout/data.tsv"
// #define TEMP_PATH       "/home/pi/workout/data.tsv.tmp"
// #define BACKUP_PATH     "/home/pi/workout/data.tsv.bak"
#define DATA_PATH       "/tmp/pi/workout/data.tsv"
#define TEMP_PATH       "/tmp/pi/workout/data.tsv.tmp"
#define BACKUP_PATH     "/tmp/pi/workout/data.tsv.bak"

#define MAX_RAM         0x100'00'000   // 256 lakh oughta be enough for anyone
#define HEADER_BUF_SIZE 0x2000

typedef struct
{
    char    method[8];
    long    content_length;   // -1 if absent (GET)
    char   *header_buf;       // raw bytes read so far, includes any body prefix
    int  header_buf_len;
    int  body_start;       // offset into header_buf where the body begins
} Request;

static int
readRequestHeader(int fd, Request *req, char *scratch)
{
    req->header_buf = scratch;
    req->header_buf_len = 0;

    for (;;)
    {
        ssize_t n = recv(fd, req->header_buf + req->header_buf_len,
                          HEADER_BUF_SIZE - req->header_buf_len, 0);
        if (n <= 0)
        {
            return -1;
        }

        req->header_buf_len += (int)n;

        char *end = memmem(req->header_buf, req->header_buf_len, "\r\n\r\n", 4);
        if (end)
        {
            req->body_start = (int)(end - req->header_buf) + 4;
            break;
        }

        if (req->header_buf_len >= HEADER_BUF_SIZE)
        {
            return -1;  // headers too large -- not a shape we expect, bail
        }
    }

    sscanf(req->header_buf, "%7s", req->method);

    req->content_length = -1;
    char *cl = strcasestr(req->header_buf, "Content-Length:");
    if (cl && (int)(cl - req->header_buf) < req->body_start)
    {
        req->content_length = atol(cl + strlen("Content-Length:"));
    }

    return 0;
}

static char*
readBody(int fd, Request *req, char *arena)
{
    if (req->content_length <= 0)
    {
        return NULL;
    }

    int total = (int)req->content_length;
    if (total > (MAX_RAM - HEADER_BUF_SIZE)) { return 0; }
    char *body = arena;

    int have_in_buf = req->header_buf_len - req->body_start;
    int have_clamped = have_in_buf < total ? have_in_buf : total;
    memcpy(body, req->header_buf + req->body_start, have_clamped);

    int got = have_clamped;
    while (got < total)
    {
        ssize_t n = recv(fd, body + got, total - got, 0);
        if ((n <= 0) || (n > MAX_RAM))
        {
            // free(body);
            return 0;
        }
        got += (int)n;
    }

    return body;
}

static void
sendResponse(int fd, int status, const char *status_text, const char *body, int body_len)
{
    char header[256];
    int header_len = snprintf(header, sizeof(header),
        "HTTP/1.1 %d %s\r\nContent-Length: %d\r\nConnection: close\r\n\r\n",
        status, status_text, body_len);
    send(fd, header, (int)header_len, 0);
    if (body_len > 0)
    {
        send(fd, body, body_len, 0);
    }
}

static void
handleGet(int fd, char *temp_arena)
{
    FILE *f = fopen(DATA_PATH, "rb");
    if (!f)
    {
        sendResponse(fd, 200, "OK", "", 0);  // no data yet -- empty is a valid first state
        return;
    }

    fseek(f, 0, SEEK_END);
    long size = ftell(f);
    assert(size >= 0);
    fseek(f, 0, SEEK_SET);

    char *buf = temp_arena;
    if (size > (MAX_RAM - HEADER_BUF_SIZE)) /* TODO(jdk): make this use a proper arena */
    {
        sendResponse(fd, 500, "Out of Memory", "", 0);
        goto CLEANUP;
    }
    int bytes_read = fread(buf, 1, (int)size, f);
    sendResponse(fd, 200, "OK", buf, bytes_read);

CLEANUP:
    fclose(f);
}

static void
handlePut(int fd, Request *req, char *temp_arena)
{
    char *body = readBody(fd, req, temp_arena);
    if (!body)
    {
        sendResponse(fd, 400, "Bad Request", "", 0);
        return;
    }

    FILE *tmp = fopen(TEMP_PATH, "wb");
    if (!tmp)
    {
        // free(body);
        sendResponse(fd, 500, "Internal Server Error", "", 0);
        return;
    }

    assert(req->content_length >= 0);
    fwrite(body, 1, (int)req->content_length, tmp);
    fclose(tmp);
    // free(body);

    rename(DATA_PATH, BACKUP_PATH);   // best-effort -- fine if DATA_PATH doesn't exist yet
    if (rename(TEMP_PATH, DATA_PATH) != 0)
    {
        sendResponse(fd, 500, "Internal Server Error", "", 0);
        return;
    }

    sendResponse(fd, 200, "OK", "", 0);
}

int
main(void)
{
    int listen_fd = socket(AF_INET, SOCK_STREAM, 0);
    int yes = 1;
    setsockopt(listen_fd, SOL_SOCKET, SO_REUSEADDR, &yes, sizeof(yes));

    struct sockaddr_in addr = {0};
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = inet_addr("127.0.0.1");  // loopback only -- nginx is the only client
    addr.sin_port = htons(LISTEN_PORT);

    if (bind(listen_fd, (struct sockaddr*)&addr, sizeof(addr)) != 0)
    {
        perror("bind");
        return 1;
    }
    listen(listen_fd, 4);

    char *arena = malloc(MAX_RAM);
    char *header_memory = arena;
    char *scratch = header_memory + HEADER_BUF_SIZE;
    for (;;)
    {
        int conn_fd = accept(listen_fd, NULL, NULL);
        if (conn_fd < 0)
        {
            continue;
        }

        Request req = {0};
        if (readRequestHeader(conn_fd, &req, header_memory) == 0)
        {
            if (strcmp(req.method, "GET") == 0)
            {
                handleGet(conn_fd, scratch);
            }
            else if (strcmp(req.method, "PUT") == 0
                  || strcmp(req.method, "POST") == 0)
            {
                handlePut(conn_fd, &req, scratch);
            }
            else
            {
                sendResponse(conn_fd, 405, "Method Not Allowed", "", 0);
            }
        }

        close(conn_fd);
    }

    return 0;
}

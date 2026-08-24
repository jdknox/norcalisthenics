// workout_server.c
//
// Minimal HTTP server for a single-user workout log.
// GET  /  -> returns the current data file
// PUT  /  -> replaces the data file (atomic write, one rotated backup)
//
// No dependencies beyond libc. Single blocking accept() loop -- this is
// a single-connection app, so there is nothing that needs to be concurrent.
// If a second request arrives while one is in flight, the kernel just
// queues it in the listen backlog until this loop comes back around.

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

#define listenPort     8081
// #define dataPath       "/home/pi/workout/data.tsv"
// #define tempPath       "/home/pi/workout/data.tsv.tmp"
// #define backupPath     "/home/pi/workout/data.tsv.bak"
#define dataPath       "/tmp/pi/workout/data.tsv"
#define tempPath       "/tmp/pi/workout/data.tsv.tmp"
#define backupPath     "/tmp/pi/workout/data.tsv.bak"
#define headerBufSize  8192

typedef struct
{
    char    method[8];
    long    contentLength;   // -1 if absent (GET)
    char*   headerBuf;       // raw bytes read so far, includes any body prefix
    size_t  headerBufLen;
    size_t  bodyStart;       // offset into headerBuf where the body begins
} Request;

static int
readRequestHeader(int fd, Request* req)
{
    req->headerBuf = malloc(headerBufSize);
    req->headerBufLen = 0;

    for (;;)
    {
        ssize_t n = recv(fd, req->headerBuf + req->headerBufLen,
                          headerBufSize - req->headerBufLen, 0);
        if (n <= 0)
            return -1;

        req->headerBufLen += (size_t)n;

        char* end = memmem(req->headerBuf, req->headerBufLen, "\r\n\r\n", 4);
        if (end)
        {
            req->bodyStart = (size_t)(end - req->headerBuf) + 4;
            break;
        }

        if (req->headerBufLen >= headerBufSize)
            return -1;  // headers too large -- not a shape we expect, bail
    }

    sscanf(req->headerBuf, "%7s", req->method);

    req->contentLength = -1;
    char* cl = strcasestr(req->headerBuf, "Content-Length:");
    if (cl && (size_t)(cl - req->headerBuf) < req->bodyStart)
        req->contentLength = atol(cl + strlen("Content-Length:"));

    return 0;
}

static char*
readBody(int fd, Request* req)
{
    if (req->contentLength <= 0)
        return NULL;

    size_t total = (size_t)req->contentLength;
    char* body = malloc(total);

    size_t haveInBuf = req->headerBufLen - req->bodyStart;
    size_t haveClamped = haveInBuf < total ? haveInBuf : total;
    memcpy(body, req->headerBuf + req->bodyStart, haveClamped);

    size_t got = haveClamped;
    while (got < total)
    {
        ssize_t n = recv(fd, body + got, total - got, 0);
        if (n <= 0)
        {
            free(body);
            return NULL;
        }
        got += (size_t)n;
    }

    return body;
}

static void
sendResponse(int fd, int status, const char* statusText, const char* body, size_t bodyLen)
{
    char header[256];
    int headerLen = snprintf(header, sizeof(header),
        "HTTP/1.1 %d %s\r\nContent-Length: %zu\r\nConnection: close\r\n\r\n",
        status, statusText, bodyLen);
    send(fd, header, (size_t)headerLen, 0);
    if (bodyLen > 0)
        send(fd, body, bodyLen, 0);
}

static void
handleGet(int fd)
{
    FILE* f = fopen(dataPath, "rb");
    if (!f)
    {
        sendResponse(fd, 200, "OK", "", 0);  // no data yet -- empty is a valid first state
        return;
    }

    fseek(f, 0, SEEK_END);
    long size = ftell(f);
    fseek(f, 0, SEEK_SET);

    char* buf = malloc((size_t)size);
    fread(buf, 1, (size_t)size, f);
    fclose(f);

    sendResponse(fd, 200, "OK", buf, (size_t)size);
    free(buf);
}

static void
handlePut(int fd, Request* req)
{
    char* body = readBody(fd, req);
    if (!body)
    {
        sendResponse(fd, 400, "Bad Request", "", 0);
        return;
    }

    FILE* tmp = fopen(tempPath, "wb");
    if (!tmp)
    {
        free(body);
        sendResponse(fd, 500, "Internal Server Error", "", 0);
        return;
    }
    fwrite(body, 1, (size_t)req->contentLength, tmp);
    fclose(tmp);
    free(body);

    rename(dataPath, backupPath);   // best-effort -- fine if dataPath doesn't exist yet
    if (rename(tempPath, dataPath) != 0)
    {
        sendResponse(fd, 500, "Internal Server Error", "", 0);
        return;
    }

    sendResponse(fd, 200, "OK", "", 0);
}

int
main(void)
{
    int listenFd = socket(AF_INET, SOCK_STREAM, 0);
    int yes = 1;
    setsockopt(listenFd, SOL_SOCKET, SO_REUSEADDR, &yes, sizeof(yes));

    struct sockaddr_in addr = {0};
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = inet_addr("127.0.0.1");  // loopback only -- nginx is the only client
    addr.sin_port = htons(listenPort);

    if (bind(listenFd, (struct sockaddr*)&addr, sizeof(addr)) != 0)
    {
        perror("bind");
        return 1;
    }
    listen(listenFd, 4);

    for (;;)
    {
        int connFd = accept(listenFd, NULL, NULL);
        if (connFd < 0)
            continue;

        Request req = {0};
        if (readRequestHeader(connFd, &req) == 0)
        {
            if (strcmp(req.method, "GET") == 0)
                { handleGet(connFd); }
            else if (strcmp(req.method, "PUT") == 0
                  || strcmp(req.method, "POST") == 0)
                { handlePut(connFd, &req); }
            else
                { sendResponse(connFd, 405, "Method Not Allowed", "", 0); }
        }

        free(req.headerBuf);
        close(connFd);
    }

    return 0;
}

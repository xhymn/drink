const { createServer } = require("node:http");
const { readFile } = require("node:fs/promises");
const { existsSync } = require("node:fs");
const { extname, join, normalize } = require("node:path");
const { execFile } = require("node:child_process");

const host = "127.0.0.1";
const port = Number(process.env.PORT || 8787);
const root = __dirname;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".md": "text/markdown; charset=utf-8"
};

createServer(async (request, response) => {
  if (request.method === "POST" && request.url === "/api/notify") {
    handleNotify(request, response);
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    send(response, 405, "Method not allowed");
    return;
  }

  try {
    const url = new URL(request.url, `http://${host}:${port}`);
    const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
    const filePath = normalize(join(root, pathname));

    if (!filePath.startsWith(root) || !existsSync(filePath)) {
      send(response, 404, "Not found");
      return;
    }

    const body = request.method === "HEAD" ? "" : await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream"
    });
    response.end(body);
  } catch {
    send(response, 500, "Server error");
  }
}).listen(port, host, () => {
  console.log(`Drink tracker running at http://${host}:${port}/`);
});

function handleNotify(request, response) {
  let body = "";
  request.on("data", (chunk) => {
    body += chunk;
    if (body.length > 4096) request.destroy();
  });
  request.on("end", () => {
    try {
      const payload = JSON.parse(body || "{}");
      const title = String(payload.title || "喝水提醒").slice(0, 80);
      const message = String(payload.body || "该喝水了。").slice(0, 240);
      const command = createNotifyCommand(title, message);

      if (!command) {
        send(response, 501, JSON.stringify({ ok: false, error: "unsupported_platform" }), "application/json");
        return;
      }

      execFile(command.file, command.args, (error) => {
        if (error) {
          send(response, 500, JSON.stringify({ ok: false, error: "notify_failed" }), "application/json");
          return;
        }
        send(response, 200, JSON.stringify({ ok: true, platform: process.platform }), "application/json");
      });
    } catch {
      send(response, 400, JSON.stringify({ ok: false }), "application/json");
    }
  });
}

function createNotifyCommand(title, message) {
  if (process.platform === "darwin") {
    return {
      file: "osascript",
      args: ["-e", `display notification ${quoteAppleScript(message)} with title ${quoteAppleScript(title)}`]
    };
  }

  if (process.platform === "linux") {
    return {
      file: "notify-send",
      args: [title, message]
    };
  }

  if (process.platform === "win32") {
    const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$notification = New-Object System.Windows.Forms.NotifyIcon
$notification.Icon = [System.Drawing.SystemIcons]::Information
$notification.BalloonTipTitle = ${quotePowerShell(title)}
$notification.BalloonTipText = ${quotePowerShell(message)}
$notification.Visible = $true
$notification.ShowBalloonTip(5000)
Start-Sleep -Seconds 6
$notification.Dispose()
`;
    return {
      file: "powershell.exe",
      args: [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-EncodedCommand",
        Buffer.from(script, "utf16le").toString("base64")
      ]
    };
  }

  return null;
}

function quoteAppleScript(value) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function quotePowerShell(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function send(response, status, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(status, { "Content-Type": contentType });
  response.end(body);
}

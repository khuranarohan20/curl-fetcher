const { ipcMain, app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const fetch = require("node-fetch");

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServerURL = process.env.VITE_DEV_SERVER_URL;
  win.loadURL(
    devServerURL || `file://${path.join(__dirname, "../dist/index.html")}`
  );
}

// Paths to store local data
const dataPath = path.join(app.getPath("userData"), "data.json");
const statePath = path.join(app.getPath("userData"), "state.json");

ipcMain.on("curl", (event, curl) => {
  event.sender.send("log", "Received cURL. Starting fetch...");

  const cookieMatch = curl.match(/-b\s+'([^']+)'/);
  const urlMatch = curl.match(/curl\s+'([^']+)'/g);
  const headerMatches = [...curl.matchAll(/-H\s+'([^']+)'/g)];

  if (!cookieMatch || !urlMatch) {
    event.sender.send("log", "Failed to parse cURL (missing cookie or URL)");
    return;
  }

  const cookie = cookieMatch[1];
  const originalUrl = urlMatch[0].replace(/curl\s+'(.+)'/, "$1");

  // Strip offset param from the original URL
  const urlBase = originalUrl.replace(/&offset=\d+/, "");
  const limit = Number(originalUrl.match(/limit=(\d+)/)?.[1] || 50);

  // Convert headers into object
  const headers = Object.fromEntries(
    headerMatches.map((h) => {
      const [key, val] = h[1].split(/:\s(.+)/);
      return [key.trim(), val.trim()];
    })
  );
  headers["Cookie"] = cookie;

  let offset = 0;

  // Resume from last offset if available
  if (fs.existsSync(statePath)) {
    const state = JSON.parse(fs.readFileSync(statePath, "utf-8"));
    offset = state.offset || 0;
  }

  const fetchPage = () => {
    const url = `${urlBase}&offset=${offset}`;

    event.sender.send("log", `Fetching offset ${offset}...`);

    fetch(url, {
      method: "GET",
      headers,
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data || (Array.isArray(data) && data.length === 0)) {
          event.sender.send("log", "No more data to fetch.");
          return;
        }

        event.sender.send("log", `Fetched offset ${offset}`);

        let existing = [];
        if (fs.existsSync(dataPath)) {
          existing = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
        }

        existing.push({ offset, data });
        fs.writeFileSync(dataPath, JSON.stringify(existing, null, 2));

        offset += limit;
        fs.writeFileSync(statePath, JSON.stringify({ offset }, null, 2));

        setTimeout(fetchPage, 10000); // Fetch every 10 seconds
      })
      .catch((err) => {
        console.error("Error fetching:", err);
        event.sender.send("log", `Error: ${err.message}`);
        setTimeout(fetchPage, 15000); // Retry slower on error
      });
  };

  fetchPage();
});

app.whenReady().then(() => {
  createWindow();
  console.log("Electron app is running...");

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

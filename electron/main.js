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

let offset = 0;
const limit = 10;

const dataPath = path.join(app.getPath("userData"), "data.json");
const statePath = path.join(app.getPath("userData"), "state.json");

ipcMain.on("curl", (event, curl) => {
  console.log("Received curl from renderer");

  event.sender.send("log", "Main process received your curl");

  //   const cookieMatch = curl.match(/-b\s+'([^']+)'/);
  //   if (!cookieMatch) {
  //     console.error("No cookie found in cURL");
  //     return;
  //   }

  //   const cookie = cookieMatch[1];

  if (fs.existsSync(statePath)) {
    const state = JSON.parse(fs.readFileSync(statePath, "utf-8"));
    offset = state.offset || 0;
  }

  const fetchPage = () => {
    const url = `https://jsonplaceholder.typicode.com/posts?_start=${offset}&_limit=${limit}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.length === 0) {
          console.log("No more data to fetch.");
          return;
        }

        console.log(`Fetched offset ${offset}`);

        let existing = [];
        if (fs.existsSync(dataPath)) {
          existing = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
        }

        existing.push({ offset, data });
        fs.writeFileSync(dataPath, JSON.stringify(existing, null, 2));

        offset += limit;
        fs.writeFileSync(statePath, JSON.stringify({ offset }, null, 2));

        setTimeout(fetchPage, 5000);
      })
      .catch((err) => {
        console.error("Error fetching:", err);
        setTimeout(fetchPage, 8000);
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

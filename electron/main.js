// main.js
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const fetch = require("node-fetch");

// Get and log app data directory
const APP_DIR = app.getPath("userData");
console.log("User data path is:", APP_DIR);

const JOBS_DIR = path.join(APP_DIR, "jobs");
const METADATA_PATH = path.join(APP_DIR, "metadata.json");

function ensureDirExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log("Created directory:", dir);
  }
}

function loadMetadata() {
  if (!fs.existsSync(METADATA_PATH)) return {};
  return JSON.parse(fs.readFileSync(METADATA_PATH, "utf-8"));
}

function saveMetadata(metadata) {
  fs.writeFileSync(METADATA_PATH, JSON.stringify(metadata, null, 2));
  console.log("Saved metadata to:", METADATA_PATH);
}

function getJobKey(curl) {
  return Buffer.from(curl)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 12);
}

function randomDelay() {
  return Math.floor(Math.random() * (15000 - 8000 + 1)) + 8000;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
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

ipcMain.on("submit-curl", (event, curl) => {
  console.log("Received cURL:", curl);
  ensureDirExists(JOBS_DIR);

  const cookieMatch = curl.match(/-b\s+'([^']+)'/);
  const urlMatch = curl.match(/curl\s+'([^']+)'/);
  const headerMatches = [...curl.matchAll(/-H\s+'([^']+)'/g)];

  if (!cookieMatch || !urlMatch) {
    event.sender.send("log", "❌ Invalid cURL: Missing cookie or URL");
    return;
  }

  const jobKey = getJobKey(curl);
  const originalUrl = urlMatch[1];
  const urlBase = originalUrl.replace(/&offset=\d+/, "");
  const limit = Number(originalUrl.match(/limit=(\d+)/)?.[1] || 50);

  const headers = Object.fromEntries(
    headerMatches.map((h) => {
      const [key, val] = h[1].split(/:\s(.+)/);
      return [key.trim(), val.trim()];
    })
  );
  headers["Cookie"] = cookieMatch[1];

  const jobDataPath = path.join(JOBS_DIR, `${jobKey}.json`);
  const jobStatePath = path.join(JOBS_DIR, `${jobKey}.state.json`);

  const metadata = loadMetadata();
  metadata[jobKey] = {
    name: `Job ${jobKey}`,
    key: jobKey,
    urlBase,
    headers,
    limit,
    dataPath: jobDataPath,
    statePath: jobStatePath,
  };
  saveMetadata(metadata);

  let offset = 0;
  if (fs.existsSync(jobStatePath)) {
    const state = JSON.parse(fs.readFileSync(jobStatePath, "utf-8"));
    offset = state.offset || 0;
    console.log("Resuming from offset:", offset);
  }

  const fetchPage = async () => {
    const url = `${urlBase}&offset=${offset}`;
    event.sender.send("log", `Fetching ${url}`);
    console.log("Fetching:", url);

    try {
      const res = await fetch(url, { method: "GET", headers });
      const data = await res.json();

      if (!data || (Array.isArray(data) && data.length === 0)) {
        event.sender.send("log", `✅ Finished fetching all data.`);
        return;
      }

      let existing = [];
      if (fs.existsSync(jobDataPath)) {
        existing = JSON.parse(fs.readFileSync(jobDataPath, "utf-8"));
      }

      existing.push({ offset, data });
      fs.writeFileSync(jobDataPath, JSON.stringify(existing, null, 2));
      fs.writeFileSync(
        jobStatePath,
        JSON.stringify({ offset: offset + limit }, null, 2)
      );
      console.log(`Saved data for offset ${offset}`);

      offset += limit;
      const delay = randomDelay();
      event.sender.send(
        "log",
        `⏳ Waiting ${delay / 1000}s before next fetch...`
      );
      setTimeout(fetchPage, delay);
    } catch (error) {
      console.error("Fetch error:", error);
      event.sender.send("log", `❌ Error: ${error.message}`);
      const delay = randomDelay();
      event.sender.send("log", `Retrying in ${delay / 1000}s...`);
      setTimeout(fetchPage, delay);
    }
  };

  fetchPage();
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

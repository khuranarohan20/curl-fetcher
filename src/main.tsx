export {};

declare global {
  interface Window {
    electronAPI: {
      sendCurl: (curl: string) => void;
      onLog: (callback: (msg: string) => void) => void;
    };
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const button = document.querySelector("button");
  const textarea = document.getElementById("curlInput") as HTMLTextAreaElement;

  button?.addEventListener("click", () => {
    const curl = textarea.value;
    if (window.electronAPI?.sendCurl) {
      console.log("Sending curl to main process");
      window.electronAPI.sendCurl(curl);
    } else {
      console.error("electronAPI not found");
    }
  });
});

window.electronAPI.onLog((msg) => {
  console.log("From main process:", msg);
});

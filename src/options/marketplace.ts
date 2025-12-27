import { initMarketplaceUI } from "./store/store";

function initialize(): void {
  document.addEventListener("DOMContentLoaded", () => {
    initMarketplaceUI();
  });
}

initialize();

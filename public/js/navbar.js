(function () {
  document.addEventListener("DOMContentLoaded", async () => {
    const placeholder = document.querySelector("[data-navbar]");
    if (!placeholder) return;

    try {
      const response = await fetch("/components/navbar.html");
      if (!response.ok) throw new Error(`Navbar request failed: ${response.status}`);
      placeholder.outerHTML = await response.text();

      const page = document.body.dataset.page || "home";
      document.querySelectorAll("[data-nav]").forEach((link) => {
        link.classList.toggle("active", link.dataset.nav === page);
      });
    } catch (error) {
      console.error("Could not load navbar:", error);
    }
  });
})();

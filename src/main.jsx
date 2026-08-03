import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// بديل حقيقي لـ window.storage الخاص بمنصّة Claude Artifacts — نفس التوقيع
// تمامًا (get/set/delete/list بنفس الحقول المُعادة)، فكود App.jsx لا يحتاج
// أي تعديل. كل استدعاء يمر عبر خادمنا (/api/storage) الذي يخزّن في قاعدة
// بيانات حقيقية مشتركة بين كل من يفتح الرابط.
const API = "/api/storage";

window.storage = {
  async get(key) {
    const r = await fetch(`${API}?key=${encodeURIComponent(key)}`);
    if (!r.ok) throw new Error("not found");
    return r.json();
  },
  async set(key, value) {
    const r = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    if (!r.ok) throw new Error("write failed");
    return r.json();
  },
  async delete(key) {
    const r = await fetch(`${API}?key=${encodeURIComponent(key)}`, { method: "DELETE" });
    if (!r.ok) throw new Error("delete failed");
    return r.json();
  },
  async list(prefix) {
    const r = await fetch(`${API}?action=list&prefix=${encodeURIComponent(prefix || "")}`);
    if (!r.ok) throw new Error("list failed");
    return r.json();
  },
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

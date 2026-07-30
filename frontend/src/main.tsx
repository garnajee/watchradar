import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { I18nProvider } from "./context/I18nContext";
import { RouterProvider } from "./context/RouterContext";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <RouterProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </RouterProvider>
    </I18nProvider>
  </React.StrictMode>
);

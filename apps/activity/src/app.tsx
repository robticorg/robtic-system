import { Home } from "./pages/home";

export function App() {
    return (
        <main style={{ fontFamily: "sans-serif", color: "#f2f3f5", background: "#313338", minHeight: "100vh", display: "grid", placeItems: "center" }}>
            <Home />
        </main>
    );
}

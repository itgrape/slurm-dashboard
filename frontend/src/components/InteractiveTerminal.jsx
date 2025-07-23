import React, { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { AttachAddon } from "@xterm/addon-attach";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import "./Terminal.css";

// Dracula 德古拉主题颜色
const draculaTheme = {
    background: "#282a36",
    foreground: "#f8f8f2",
    cursor: "#f8f8f2",
    selectionBackground: "#44475a",
    black: "#000000",
    brightBlack: "#44475a",
    red: "#ff5555",
    brightRed: "#ff5555",
    green: "#50fa7b",
    brightGreen: "#50fa7b",
    yellow: "#f1fa8c",
    brightYellow: "#f1fa8c",
    blue: "#bd93f9",
    brightBlue: "#bd93f9",
    magenta: "#ff79c6",
    brightMagenta: "#ff79c6",
    cyan: "#8be9fd",
    brightCyan: "#8be9fd",
    white: "#f8f8f2",
    brightWhite: "#ffffff",
};

const InteractiveTerminal = ({ sessionId, token, isActive }) => {
    const terminalRef = useRef(null);
    const termInstance = useRef(null);
    const fitAddonInstance = useRef(null);

    // 初始化和连接逻辑
    useEffect(() => {
        if (!sessionId || !token || !terminalRef.current || termInstance.current) {
            return;
        }

        // 1. 创建 XTerm 实例和 FitAddon
        fitAddonInstance.current = new FitAddon();
        const term = new XTerm({
            fontFamily:
                '"FiraCode Nerd Font", "Fira Code", "JetBrains Mono", Menlo, Consolas, "Courier New", monospace',
            fontSize: 14,
            theme: draculaTheme,
            cursorBlink: true,
            cursorStyle: "bar",
            allowTransparency: true,
            scrollback: 2000,
        });
        termInstance.current = term;
        term.loadAddon(fitAddonInstance.current);

        // 2. 创建 WebSocket 连接
        // 根据后端路由，这里的 URL 需要包含 session_id 和 token
        const wsUrl = `${import.meta.env.VITE_WS_BASE_URL}/v1/salloc/interactive/${sessionId}/attach?token=${token}`;
        const socket = new WebSocket(wsUrl);

        // 3. 附加 WebSocket 到终端
        const attachAddon = new AttachAddon(socket);
        term.loadAddon(attachAddon);

        // 4. 打开终端并适应容器大小
        term.open(terminalRef.current);
        fitAddonInstance.current.fit();

        const handleResize = () => {
            fitAddonInstance.current?.fit();
        };
        window.addEventListener("resize", handleResize);

        // 5. 清理函数
        return () => {
            window.removeEventListener("resize", handleResize);
            socket.close();
            term.dispose();
            termInstance.current = null;
        };
    }, [sessionId, token]);

    // 当标签页激活时，调整终端大小
    useEffect(() => {
        if (isActive) {
            const timer = setTimeout(() => {
                fitAddonInstance.current?.fit();
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [isActive]);

    return (
        <div
            ref={terminalRef}
            style={{
                height: "100%",
                width: "100%",
                padding: "6px",
                boxSizing: "border-box",
                backgroundColor: draculaTheme.background,
                overflow: "hidden",
            }}
        />
    );
};

export default InteractiveTerminal;

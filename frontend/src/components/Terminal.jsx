import React, { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { AttachAddon } from "@xterm/addon-attach";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import "./Terminal.css";

// Dracula 德古拉主题颜色
const draculaTheme = {
    background: '#282a36',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
    selectionBackground: '#44475a',
    black: '#000000',
    brightBlack: '#44475a',
    red: '#ff5555',
    brightRed: '#ff5555',
    green: '#50fa7b',
    brightGreen: '#50fa7b',
    yellow: '#f1fa8c',
    brightYellow: '#f1fa8c',
    blue: '#bd93f9',
    brightBlue: '#bd93f9',
    magenta: '#ff79c6',
    brightMagenta: '#ff79c6',
    cyan: '#8be9fd',
    brightCyan: '#8be9fd',
    white: '#f8f8f2',
    brightWhite: '#ffffff',
};


const Terminal = ({ isOpen }) => {
    const terminalRef = useRef(null);
    const termInstance = useRef(null);
    const fitAddonInstance = useRef(null);

    useEffect(() => {
        if (termInstance.current || !terminalRef.current) {
            return;
        }

        fitAddonInstance.current = new FitAddon();

        const term = new XTerm({
            // 字体
            fontFamily: '"FiraCode Nerd Font", "Fira Code", "JetBrains Mono", Menlo, Consolas, "Courier New", monospace',
            fontSize: 14,
            lineHeight: 1.2,
            
            // 主题
            theme: draculaTheme,

            // 光标
            cursorBlink: true,
            cursorStyle: 'block', // 'block', 'underline', 'bar'

            // 其他视觉效果
            convertEol: true, // 启用时，光标将设置为下一行的开头
            scrollback: 1000, // 终端回滚的行数
            allowTransparency: true, // 允许背景透明
        });

        termInstance.current = term;
        term.loadAddon(fitAddonInstance.current);

        const token = localStorage.getItem("token");
        const wsUrl = import.meta.env.VITE_WS_BASE_URL + `/v1/shell?token=${token}`;
        const socket = new WebSocket(wsUrl);

        const attachAddon = new AttachAddon(socket);
        term.loadAddon(attachAddon);

        term.open(terminalRef.current);
        fitAddonInstance.current.fit();
        const handleResize = () => {
            fitAddonInstance.current?.fit();
        };
        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, []);

    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                fitAddonInstance.current?.fit();
            }, 200);

            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    return (
        <div
            ref={terminalRef}
            style={{
                height: "100%",
                width: "100%",
                padding: "10px",
                boxSizing: 'border-box',
                backgroundColor: draculaTheme.background,
                overflow: "hidden",
            }}
        />
    );
};

export default Terminal;
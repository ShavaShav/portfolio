import { useCallback, useEffect, useRef, useState } from "react";
import { audioManager } from "../audio/AudioManager";
import { getDeviceCapability } from "../hooks/useDeviceCapability";
import {
  TERMINAL_INTRO_LINES,
  TERMINAL_LAUNCH_LINES,
  TERMINAL_PROMPT,
  TERMINAL_STATIC_RESPONSES,
  UNKNOWN_COMMAND_RESPONSE,
  getHelpLines,
} from "../data/terminalCommands";
import "./Terminal.css";

type TerminalProps = {
  onLaunch: () => void;
  audioEnabled: boolean;
  onSetAudioEnabled: (enabled: boolean) => void;
};

type OutputLine = {
  id: string;
  text: string;
  tone?: "default" | "amber";
};

const TYPE_DELAY_MIN = 30;
const TYPE_DELAY_MAX = 70;

function randomTypeDelay() {
  return (
    Math.floor(Math.random() * (TYPE_DELAY_MAX - TYPE_DELAY_MIN + 1)) +
    TYPE_DELAY_MIN
  );
}

function createLineId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function Terminal({
  onLaunch,
  audioEnabled,
  onSetAudioEnabled,
}: TerminalProps) {
  const [outputLines, setOutputLines] = useState<OutputLine[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLaunching, setIsLaunching] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const timeoutIdsRef = useRef<number[]>([]);
  const typingGenerationRef = useRef(0);
  const introCancelledRef = useRef(false);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const appendLine = useCallback((text: string, tone?: OutputLine["tone"]) => {
    setOutputLines((previous) => [
      ...previous,
      { id: createLineId(), text, tone },
    ]);
  }, []);

  const typeLine = useCallback((text: string, tone?: OutputLine["tone"]) => {
    return new Promise<void>((resolve) => {
      const generation = typingGenerationRef.current;
      const lineId = createLineId();
      setOutputLines((previous) => [
        ...previous,
        { id: lineId, text: "", tone },
      ]);

      if (text.length === 0) {
        resolve();
        return;
      }

      let index = 0;

      const tick = () => {
        if (generation !== typingGenerationRef.current) {
          resolve();
          return;
        }

        index += 1;
        setOutputLines((previous) =>
          previous.map((line) =>
            line.id === lineId ? { ...line, text: text.slice(0, index) } : line,
          ),
        );

        if (index < text.length) {
          const tid = window.setTimeout(tick, randomTypeDelay());
          timeoutIdsRef.current.push(tid);
          return;
        }

        resolve();
      };

      const tid = window.setTimeout(tick, randomTypeDelay());
      timeoutIdsRef.current.push(tid);
    });
  }, []);

  const runLaunchSequence = useCallback(
    async (options?: { force?: boolean }) => {
      if (isLaunching) {
        return;
      }

      const force = options?.force ?? false;
      setIsLaunching(true);
      introCancelledRef.current = true;
      typingGenerationRef.current += 1;

      if (force) {
        audioManager.playTransition();
        appendLine("> Launch override accepted. Skipping sequence.");
        setIsTransitioning(true);
        window.setTimeout(onLaunch, 160);
        return;
      }

      for (const line of TERMINAL_LAUNCH_LINES) {
        if (line.includes("3... 2... 1...")) {
          audioManager.playLaunchCountdown();
        }
        await typeLine(line);
      }

      audioManager.playLaunchIgnition();
      setIsTransitioning(true);
      window.setTimeout(onLaunch, 600);
    },
    [appendLine, isLaunching, onLaunch, typeLine],
  );

  const executeCommand = useCallback(
    async (rawCommand: string) => {
      const args = rawCommand
        .trim()
        .split(/\s+/)
        .filter((entry) => entry.length > 0);
      const command = args[0]?.toLowerCase() ?? "";
      const subcommand = args[1]?.toLowerCase();
      appendLine(`${TERMINAL_PROMPT} ${rawCommand}`);

      if (command === "") {
        return;
      }

      if (command === "clear") {
        setOutputLines([]);
        return;
      }

      if (command === "help") {
        for (const line of getHelpLines()) {
          appendLine(line);
        }
        return;
      }

      if (command === "sound") {
        if (!subcommand) {
          const nextEnabled = !audioEnabled;
          onSetAudioEnabled(nextEnabled);
          appendLine(`> Audio ${nextEnabled ? "enabled" : "disabled"}.`);
          return;
        }

        if (subcommand === "on" || subcommand === "off") {
          const nextEnabled = subcommand === "on";
          if (nextEnabled === audioEnabled) {
            appendLine(`> Audio already ${nextEnabled ? "enabled" : "disabled"}.`);
            return;
          }

          onSetAudioEnabled(nextEnabled);
          appendLine(`> Audio ${nextEnabled ? "enabled" : "disabled"}.`);
          return;
        }

        appendLine("> Usage: sound [on|off]", "amber");
        return;
      }

      if (command === "launch") {
        const launchArgs = args.slice(1).map((arg) => arg.toLowerCase());
        const hasForceFlag =
          launchArgs.includes("-f") || launchArgs.includes("--force");
        const hasInvalidFlag = launchArgs.some(
          (arg) => arg !== "-f" && arg !== "--force",
        );

        if (hasInvalidFlag) {
          appendLine("> Usage: launch [-f|--force]", "amber");
          return;
        }

        await runLaunchSequence({ force: hasForceFlag });
        return;
      }

      if (command === "resume") {
        window.open("/resume.pdf", "_blank", "noopener,noreferrer");
        appendLine(
          "> Opening resume in a new tab. If blocked, allow popups for this site.",
        );
        return;
      }

      if (command in TERMINAL_STATIC_RESPONSES) {
        for (const line of TERMINAL_STATIC_RESPONSES[command]) {
          appendLine(line);
        }
        return;
      }

      appendLine(UNKNOWN_COMMAND_RESPONSE, "amber");
    },
    [appendLine, audioEnabled, onSetAudioEnabled, runLaunchSequence],
  );

  useEffect(() => {
    focusInput();
  }, [focusInput]);

  useEffect(() => {
    const outputElement = outputRef.current;
    if (!outputElement) {
      return;
    }

    outputElement.scrollTop = outputElement.scrollHeight;
  }, [outputLines, inputValue]);

  useEffect(() => {
    let cancelled = false;
    introCancelledRef.current = false;

    const boot = async () => {
      for (const line of TERMINAL_INTRO_LINES) {
        if (cancelled || introCancelledRef.current) {
          return;
        }

        await typeLine(line);
      }
    };

    void boot();

    return () => {
      cancelled = true;
      introCancelledRef.current = true;
      for (const tid of timeoutIdsRef.current) {
        window.clearTimeout(tid);
      }
      timeoutIdsRef.current = [];
      setOutputLines([]);
    };
  }, [typeLine]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      // Play keystroke sound for printable characters and backspace
      if (event.key.length === 1 || event.key === "Backspace") {
        audioManager.playType();
      }

      if (event.key !== "Enter") {
        return;
      }

      event.preventDefault();

      if (isLaunching) {
        return;
      }

      const nextCommand = inputValue;
      setInputValue("");

      if (nextCommand.trim().length === 0) {
        return;
      }

      void executeCommand(nextCommand);
    },
    [executeCommand, inputValue, isLaunching],
  );

  return (
    <div
      className={`terminal-screen ${isTransitioning ? "terminal-screen--fade" : ""}`}
      onClick={focusInput}
      onMouseDown={focusInput}
      role="presentation"
    >
      <div className="terminal-screen__output" ref={outputRef}>
        {outputLines.map((line) => (
          <p
            className={`terminal-screen__line ${line.tone === "amber" ? "terminal-screen__line--amber" : ""}`}
            key={line.id}
          >
            {line.text || " "}
          </p>
        ))}

        <p className="terminal-screen__prompt">
          <span className="terminal-screen__prompt-label">
            {TERMINAL_PROMPT}{" "}
          </span>
          <span>{inputValue}</span>
          <span className="terminal-screen__cursor">_</span>
        </p>
      </div>

      <input
        className="terminal-screen__hidden-input"
        onChange={(event) => setInputValue(event.target.value)}
        onKeyDown={handleKeyDown}
        ref={inputRef}
        value={inputValue}
      />

      {/* Mobile launch button */}
      {getDeviceCapability().isMobile && !isLaunching ? (
        <button
          className="terminal-screen__launch-btn"
          onClick={() => void runLaunchSequence()}
          type="button"
        >
          LAUNCH
        </button>
      ) : null}
    </div>
  );
}

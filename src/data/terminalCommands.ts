export const TERMINAL_PROMPT = "visitor@zachshaver.com:~$";

export type TerminalCommandDefinition = {
  command: string;
  description: string;
};

export const TERMINAL_INTRO_LINES = [
  "> Establishing secure connection...",
  "> Connection established.",
  "> Welcome to zachshaver.com",
  ">",
  "> Type 'help' for commands, or 'launch' to begin.",
];

export const TERMINAL_COMMANDS: TerminalCommandDefinition[] = [
  { command: "help", description: "List available commands" },
  { command: "launch", description: "Begin the flight sequence" },
  { command: "about", description: "Quick bio" },
  { command: "whoami", description: "Identity check" },
  { command: "ls", description: "List destinations" },
  { command: "sudo", description: "You can try" },
  { command: "clear", description: "Clear terminal output" },
  { command: "resume", description: "Open resume PDF" },
];

export const TERMINAL_LAUNCH_LINES = [
  "> Initializing launch sequence...",
  "> Loading navigation systems... [OK]",
  "> Calibrating star charts...    [OK]",
  "> Engaging warp drive...        [OK]",
  ">",
  "> 3... 2... 1...",
];

export const TERMINAL_STATIC_RESPONSES: Record<string, string[]> = {
  about: [
    "> Zach Shaver - Software Engineer focused on full-stack and AI systems.",
    "> Currently building critical systems at Obviant in Arlington, VA.",
  ],
  whoami: ["> visitor - but you're about to meet Zach"],
  ls: ["> obviant/ aws/ riskfuel/ open-source/ about/"],
  sudo: ["> Nice try."],
};

export const UNKNOWN_COMMAND_RESPONSE = "> Command not found. Type 'help'.";

export function getHelpLines(): string[] {
  return [
    "> Available commands:",
    ...TERMINAL_COMMANDS.map(
      ({ command, description }) =>
        `> ${command.padEnd(7, " ")} - ${description}`,
    ),
  ];
}

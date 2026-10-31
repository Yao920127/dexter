import { t, type MessageKey } from '../i18n/index.js';

export interface SlashCommand {
  name: string;
  description: string;
}

const COMMAND_NAMES = [
  'model',
  'search',
  'rules',
  'clear',
  'memory',
  'heartbeat',
  'history',
  'language',
  'help',
] as const;

/** Built on demand so descriptions follow the current UI language. */
export function getSlashCommands(): SlashCommand[] {
  return COMMAND_NAMES.map((name) => ({ name, description: t(`cmd.${name}` as MessageKey) }));
}

/**
 * Filter commands matching the current input.
 * Input should start with "/". Bare "/" returns all commands.
 */
export function matchCommands(input: string): SlashCommand[] {
  const query = input.slice(1).toLowerCase();
  const commands = getSlashCommands();
  if (query === '') return commands;
  return commands.filter(cmd => cmd.name.startsWith(query));
}

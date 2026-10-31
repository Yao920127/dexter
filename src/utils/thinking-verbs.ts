import { getLanguage } from '../i18n/index.js';

export const THINKING_VERBS = [
  'Analyzing', 'Assessing', 'Brainstorming', 'Brewing',
  'Calculating', 'Calibrating', 'Catalyzing', 'Cerebrating',
  'Churning', 'Cogitating', 'Constructing', 'Crafting',
  'Crunching', 'Deliberating', 'Distilling', 'Drafting',
  'Engineering', 'Evaluating', 'Experimenting', 'Finessing',
  'Formulating', 'Forging', 'Hatching', 'Hypothesizing',
  'Ideating', 'Inventing', 'Marinating', 'Modeling',
  'Mulling', 'Musing', 'Observing', 'Percolating',
  'Pondering', 'Processing', 'Puzzling', 'Reviewing',
  'Riffing', 'Ruminating', 'Sculpting', 'Simmering',
  'Sketching', 'Synthesizing', 'Tinkering', 'Triangulating',
  'Verifying', 'Whittling', 'Wrangling',
] as const;

export const THINKING_VERBS_ZH = [
  '分析中', '評估中', '思考中', '推算中', '整理中', '研究中',
  '驗證中', '彙整中', '比對中', '檢視中', '歸納中', '醞釀中',
] as const;

export function getRandomThinkingVerb(): string {
  const verbs = getLanguage() === 'zh-TW' ? THINKING_VERBS_ZH : THINKING_VERBS;
  return verbs[Math.floor(Math.random() * verbs.length)];
}

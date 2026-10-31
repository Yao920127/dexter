import { Container, Spacer, Text } from '@mariozechner/pi-tui';
import packageJson from '../../package.json';
import { getModelDisplayName } from '../utils/model.js';
import { theme } from '../theme.js';
import { displayWidth, t } from '../i18n/index.js';

const INTRO_WIDTH = 50;

export class IntroComponent extends Container {
  private readonly modelText: Text;
  private readonly welcomeBox: Text;
  private readonly taglineText: Text;
  private model: string;

  constructor(model: string) {
    super();
    this.model = model;
    this.welcomeBox = new Text('', 0, 0);

    this.addChild(new Spacer(1));
    this.addChild(new Text(theme.primary('═'.repeat(INTRO_WIDTH)), 0, 0));
    this.addChild(this.welcomeBox);
    this.addChild(new Text(theme.primary('═'.repeat(INTRO_WIDTH)), 0, 0));
    this.addChild(new Spacer(1));

    this.addChild(
      new Text(
        theme.bold(
          theme.primary(
            `
██████╗ ███████╗██╗  ██╗████████╗███████╗██████╗ 
██╔══██╗██╔════╝╚██╗██╔╝╚══██╔══╝██╔════╝██╔══██╗
██║  ██║█████╗   ╚███╔╝    ██║   █████╗  ██████╔╝
██║  ██║██╔══╝   ██╔██╗    ██║   ██╔══╝  ██╔══██╗
██████╔╝███████╗██╔╝ ██╗   ██║   ███████╗██║  ██║
╚═════╝ ╚══════╝╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝`,
          ),
        ),
        0,
        0,
      ),
    );

    this.addChild(new Spacer(1));
    this.taglineText = new Text('', 0, 0);
    this.addChild(this.taglineText);
    this.modelText = new Text('', 0, 0);
    this.addChild(this.modelText);
    this.refresh();
  }

  /** Re-render all translatable text (called after a language switch). */
  refresh() {
    const welcomeText = t('intro.welcome');
    const versionText = ` v${packageJson.version}`;
    const fullWidth = displayWidth(welcomeText + versionText);
    const padding = Math.max(0, Math.floor((INTRO_WIDTH - fullWidth - 2) / 2));
    const trailing = Math.max(0, INTRO_WIDTH - fullWidth - padding - 2);
    this.welcomeBox.setText(
      theme.primary(
        `║${' '.repeat(padding)}${theme.bold(welcomeText)}${theme.muted(versionText)}${' '.repeat(trailing)}║`,
      ),
    );
    this.taglineText.setText(t('intro.tagline'));
    this.setModel(this.model);
  }

  setModel(model: string) {
    this.model = model;
    this.modelText.setText(
      `${theme.muted(t('intro.model'))}${theme.primary(getModelDisplayName(model))}`,
    );
  }
}

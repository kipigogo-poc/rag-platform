import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import { ChatService } from '../chat/chat.service';
import { TelegramSessionsService } from './telegram-sessions.service';

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private bot: Telegraf | null = null;

  // Per-chat conversation history (in-memory, cleared on /start or document switch)
  private readonly histories = new Map<
    number,
    Array<{ role: 'user' | 'assistant'; content: string }>
  >();

  constructor(
    private readonly config: ConfigService,
    private readonly chatService: ChatService,
    private readonly sessions: TelegramSessionsService,
  ) {}

  onModuleInit() {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN is not set — Telegram bot will not start. ' +
          'Set it in backend/.env to enable the bot.',
      );
      return;
    }

    this.bot = new Telegraf(token);
    this.registerHandlers(this.bot);

    this.bot.launch().catch((err: Error) => {
      this.logger.error(`Bot launch failed: ${err.message}`);
    });

    this.logger.log('Telegram bot started (polling)');
  }

  onModuleDestroy() {
    this.bot?.stop('SIGTERM');
  }

  // ── Public method for generating a link token (called by the web API) ────────
  async createLinkToken(userId: string): Promise<string> {
    return this.sessions.createLinkToken(userId);
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────

  private registerHandlers(bot: Telegraf) {
    bot.command('start', (ctx) => this.handleStart(ctx));
    bot.command('link', (ctx) => this.handleLink(ctx));
    bot.command('unlink', (ctx) => this.handleUnlink(ctx));
    bot.command('subjects', (ctx) => this.handleSubjects(ctx));
    bot.command('use', (ctx) => this.handleUse(ctx));
    bot.command('docs', (ctx) => this.handleDocs(ctx));
    bot.command('doc', (ctx) => this.handleDoc(ctx));
    bot.command('status', (ctx) => this.handleStatus(ctx));
    bot.command('clear', (ctx) => this.handleClear(ctx));
    bot.command('help', (ctx) => this.handleHelp(ctx));
    bot.on(message('text'), (ctx) => this.handleMessage(ctx));
  }

  private async handleStart(ctx: Context) {
    const telegramId = ctx.from!.id;
    this.histories.delete(telegramId);

    const session = await this.sessions.getSession(telegramId);
    if (session) {
      await ctx.reply(
        `Welcome back! You're already linked.\n\nUse /subjects to pick a subject, then /docs to pick a document, then just ask me anything about it.\n\nType /help for all commands.`,
      );
    } else {
      await ctx.reply(
        `Hi! I'm your RAG study assistant.\n\nTo get started:\n1. Open the web app and click "Connect Telegram"\n2. Copy the token shown\n3. Send me: /link <your-token>\n\nThen you can chat about any document you've uploaded!`,
      );
    }
  }

  private async handleLink(ctx: Context) {
    const telegramId = ctx.from!.id;
    const parts = (ctx.message as { text: string }).text.trim().split(/\s+/);
    const token = parts[1];

    if (!token) {
      return ctx.reply('Usage: /link <token>\n\nGet a token from the web app by clicking "Connect Telegram".');
    }

    const userId = await this.sessions.consumeLinkToken(token);
    if (!userId) {
      return ctx.reply('Invalid or expired token. Tokens are valid for 15 minutes — generate a new one in the web app.');
    }

    await this.sessions.setSession(telegramId, userId);
    await ctx.reply(
      `Linked! Your Telegram account is now connected.\n\nNext:\n• /subjects — see your subjects\n• /use <number> — pick a subject\n• /docs — see documents in that subject\n• /doc <number> — pick a document\n• Then just ask me anything!`,
    );
  }

  private async handleUnlink(ctx: Context) {
    await this.sessions.clearSession(ctx.from!.id);
    this.histories.delete(ctx.from!.id);
    await ctx.reply('Unlinked. Your Telegram account has been disconnected from the app.');
  }

  private async handleSubjects(ctx: Context) {
    const telegramId = ctx.from!.id;
    const session = await this.requireLinked(ctx);
    if (!session) return;

    const subjects = await this.sessions.listSubjects(session.userId);
    if (!subjects.length) {
      return ctx.reply("You don't have any subjects yet. Create one in the web app first.");
    }

    const list = subjects.map((s, i) => `${i + 1}. ${s.name}`).join('\n');
    await ctx.reply(`Your subjects:\n\n${list}\n\nUse /use <number> to select one.`);
  }

  private async handleUse(ctx: Context) {
    const telegramId = ctx.from!.id;
    const session = await this.requireLinked(ctx);
    if (!session) return;

    const parts = (ctx.message as { text: string }).text.trim().split(/\s+/);
    const num = parseInt(parts[1], 10);

    const subjects = await this.sessions.listSubjects(session.userId);
    if (isNaN(num) || num < 1 || num > subjects.length) {
      return ctx.reply(`Please give a number between 1 and ${subjects.length}.\nUse /subjects to see the list.`);
    }

    const chosen = subjects[num - 1];
    await this.sessions.setSession(telegramId, session.userId, chosen.id, null);
    this.histories.delete(telegramId);

    await ctx.reply(
      `Subject set to: *${chosen.name}*\n\nNow use /docs to see documents in this subject, then /doc <number> to pick one.`,
      { parse_mode: 'Markdown' },
    );
  }

  private async handleDocs(ctx: Context) {
    const telegramId = ctx.from!.id;
    const session = await this.requireLinked(ctx);
    if (!session) return;

    if (!session.activeSubjectId) {
      return ctx.reply('No subject selected. Use /subjects then /use <number> first.');
    }

    const docs = await this.sessions.listSessions(session.userId, session.activeSubjectId);
    if (!docs.length) {
      return ctx.reply("No documents in this subject yet. Upload one from the web app.");
    }

    const list = docs.map((d, i) => `${i + 1}. ${d.fileName}`).join('\n');
    await ctx.reply(`Documents in this subject:\n\n${list}\n\nUse /doc <number> to select one.`);
  }

  private async handleDoc(ctx: Context) {
    const telegramId = ctx.from!.id;
    const session = await this.requireLinked(ctx);
    if (!session) return;

    if (!session.activeSubjectId) {
      return ctx.reply('No subject selected. Use /subjects then /use <number> first.');
    }

    const parts = (ctx.message as { text: string }).text.trim().split(/\s+/);
    const num = parseInt(parts[1], 10);
    const docs = await this.sessions.listSessions(session.userId, session.activeSubjectId);

    if (isNaN(num) || num < 1 || num > docs.length) {
      return ctx.reply(`Please give a number between 1 and ${docs.length}.\nUse /docs to see the list.`);
    }

    const chosen = docs[num - 1];
    await this.sessions.setSession(
      telegramId,
      session.userId,
      session.activeSubjectId,
      chosen.sessionId,
    );
    this.histories.delete(telegramId);

    await ctx.reply(
      `Document set to: *${chosen.fileName}*\n\nReady! Ask me anything about this document.`,
      { parse_mode: 'Markdown' },
    );
  }

  private async handleStatus(ctx: Context) {
    const telegramId = ctx.from!.id;
    const session = await this.requireLinked(ctx);
    if (!session) return;

    let text = `Linked: yes\n`;

    if (session.activeSubjectId) {
      const subjects = await this.sessions.listSubjects(session.userId);
      const subject = subjects.find((s) => s.id === session.activeSubjectId);
      text += `Subject: ${subject?.name ?? session.activeSubjectId}\n`;
    } else {
      text += `Subject: not selected\n`;
    }

    if (session.activeSessionId) {
      const docs = await this.sessions.listSessions(session.userId, session.activeSubjectId!);
      const doc = docs.find((d) => d.sessionId === session.activeSessionId);
      text += `Document: ${doc?.fileName ?? session.activeSessionId}\n`;
    } else {
      text += `Document: not selected\n`;
    }

    const history = this.histories.get(telegramId) ?? [];
    text += `Conversation turns: ${history.length}`;

    await ctx.reply(text);
  }

  private async handleClear(ctx: Context) {
    this.histories.delete(ctx.from!.id);
    await ctx.reply('Conversation history cleared. Fresh start!');
  }

  private async handleHelp(ctx: Context) {
    await ctx.reply(
      `/start — Welcome message\n` +
      `/link <token> — Link to your web app account\n` +
      `/unlink — Disconnect this Telegram account\n` +
      `/subjects — List your subjects\n` +
      `/use <n> — Select a subject by number\n` +
      `/docs — List documents in selected subject\n` +
      `/doc <n> — Select a document by number\n` +
      `/status — Show current subject & document\n` +
      `/clear — Clear conversation history\n` +
      `/help — Show this message\n\n` +
      `Once a document is selected, just type your question!`,
    );
  }

  private async handleMessage(ctx: Context) {
    const telegramId = ctx.from!.id;
    const userText = (ctx.message as { text: string }).text;

    const session = await this.requireLinked(ctx);
    if (!session) return;

    if (!session.activeSubjectId || !session.activeSessionId) {
      return ctx.reply(
        "No document selected yet.\n\n" +
        "1. /subjects — see your subjects\n" +
        "2. /use <n> — pick a subject\n" +
        "3. /docs — see documents\n" +
        "4. /doc <n> — pick a document\n\n" +
        "Then ask away!",
      );
    }

    // Show typing indicator
    await ctx.sendChatAction('typing');

    const history = this.histories.get(telegramId) ?? [];

    try {
      const reply = await this.chatService.ask(
        userText,
        session.userId,
        session.activeSubjectId,
        session.activeSessionId,
        history,
      );

      // Update history (keep last 10 turns = 20 messages)
      history.push({ role: 'user', content: userText });
      history.push({ role: 'assistant', content: reply });
      this.histories.set(telegramId, history.slice(-20));

      await ctx.reply(reply);
    } catch {
      await ctx.reply("Sorry, something went wrong while generating the answer. Please try again.");
    }
  }

  // ── Guard helpers ─────────────────────────────────────────────────────────────

  private async requireLinked(ctx: Context) {
    const session = await this.sessions.getSession(ctx.from!.id);
    if (!session) {
      await ctx.reply(
        "You're not linked yet. Get a token from the web app by clicking 'Connect Telegram', then send:\n\n/link <token>",
      );
      return null;
    }
    return session;
  }
}

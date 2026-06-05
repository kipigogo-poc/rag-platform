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

  createLinkToken(userId: string): Promise<string> {
    return this.sessions.createLinkToken(userId);
  }

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
        `Welcome back — you're linked.\n\n/subjects → pick a subject\n/docs → pick a doc\nThen ask anything.\n\n/help for commands.`,
      );
      return;
    }

    await ctx.reply(
      `Study assistant, at your service.\n\n1. Open the web app → profile → Get link token\n2. Copy the /link command\n3. Send it here\n\nThen chat about any doc you've uploaded.`,
    );
  }

  private async handleLink(ctx: Context) {
    const telegramId = ctx.from!.id;
    const parts = (ctx.message as { text: string }).text.trim().split(/\s+/);
    const token = parts[1];

    if (!token) {
      return ctx.reply('Send: /link <token>\n\nGrab one in the web app under your profile.');
    }

    const userId = await this.sessions.consumeLinkToken(token);
    if (!userId) {
      return ctx.reply('Bad or expired token. Tokens last 15 min — grab a fresh one in the app.');
    }

    await this.sessions.setSession(telegramId, userId);
    await ctx.reply(
      `Linked.\n\n/subjects — your subjects\n/use <n> — pick one\n/docs — docs in that subject\n/doc <n> — pick a doc\nThen ask away.`,
    );
  }

  private async handleUnlink(ctx: Context) {
    await this.sessions.clearSession(ctx.from!.id);
    this.histories.delete(ctx.from!.id);
    await ctx.reply('Unlinked. This Telegram account is disconnected.');
  }

  private async handleSubjects(ctx: Context) {
    const session = await this.requireLinked(ctx);
    if (!session) return;

    const subjects = await this.sessions.listSubjects(session.userId);
    if (!subjects.length) {
      return ctx.reply('No subjects yet. Make one in the web app first.');
    }

    const list = subjects.map((s, i) => `${i + 1}. ${s.name}`).join('\n');
    await ctx.reply(`Your subjects:\n\n${list}\n\n/use <number> to pick one.`);
  }

  private async handleUse(ctx: Context) {
    const telegramId = ctx.from!.id;
    const session = await this.requireLinked(ctx);
    if (!session) return;

    const parts = (ctx.message as { text: string }).text.trim().split(/\s+/);
    const num = parseInt(parts[1], 10);

    const subjects = await this.sessions.listSubjects(session.userId);
    if (isNaN(num) || num < 1 || num > subjects.length) {
      return ctx.reply(`Use a number from 1 to ${subjects.length}.\n/subjects to see the list.`);
    }

    const chosen = subjects[num - 1];
    await this.sessions.setSession(telegramId, session.userId, chosen.id, null);
    this.histories.delete(telegramId);

    await ctx.reply(
      `Subject: *${chosen.name}*\n\n/docs to list docs, then /doc <number> to pick one.`,
      { parse_mode: 'Markdown' },
    );
  }

  private async handleDocs(ctx: Context) {
    const session = await this.requireLinked(ctx);
    if (!session) return;

    if (!session.activeSubjectId) {
      return ctx.reply('Pick a subject first: /subjects then /use <number>.');
    }

    const docs = await this.sessions.listSessions(session.userId, session.activeSubjectId);
    if (!docs.length) {
      return ctx.reply('No docs in this subject yet. Upload one in the web app.');
    }

    const list = docs.map((d, i) => `${i + 1}. ${d.fileName}`).join('\n');
    await ctx.reply(`Docs in this subject:\n\n${list}\n\n/doc <number> to pick one.`);
  }

  private async handleDoc(ctx: Context) {
    const telegramId = ctx.from!.id;
    const session = await this.requireLinked(ctx);
    if (!session) return;

    if (!session.activeSubjectId) {
      return ctx.reply('Pick a subject first: /subjects then /use <number>.');
    }

    const parts = (ctx.message as { text: string }).text.trim().split(/\s+/);
    const num = parseInt(parts[1], 10);
    const docs = await this.sessions.listSessions(session.userId, session.activeSubjectId);

    if (isNaN(num) || num < 1 || num > docs.length) {
      return ctx.reply(`Use a number from 1 to ${docs.length}.\n/docs to see the list.`);
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
      `Doc: *${chosen.fileName}*\n\nAsk me anything about it.`,
      { parse_mode: 'Markdown' },
    );
  }

  private async handleStatus(ctx: Context) {
    const telegramId = ctx.from!.id;
    const session = await this.requireLinked(ctx);
    if (!session) return;

    let text = 'Linked: yes\n';

    if (session.activeSubjectId) {
      const subjects = await this.sessions.listSubjects(session.userId);
      const subject = subjects.find((s) => s.id === session.activeSubjectId);
      text += `Subject: ${subject?.name ?? session.activeSubjectId}\n`;
    } else {
      text += 'Subject: none picked\n';
    }

    if (session.activeSessionId) {
      const docs = await this.sessions.listSessions(session.userId, session.activeSubjectId!);
      const doc = docs.find((d) => d.sessionId === session.activeSessionId);
      text += `Doc: ${doc?.fileName ?? session.activeSessionId}\n`;
    } else {
      text += 'Doc: none picked\n';
    }

    const history = this.histories.get(telegramId) ?? [];
    text += `Turns in chat: ${history.length}`;

    await ctx.reply(text);
  }

  private async handleClear(ctx: Context) {
    this.histories.delete(ctx.from!.id);
    await ctx.reply('Chat cleared. Fresh start.');
  }

  private async handleHelp(ctx: Context) {
    await ctx.reply(
      `/start — intro\n` +
        `/link <token> — connect your account\n` +
        `/unlink — disconnect\n` +
        `/subjects — list subjects\n` +
        `/use <n> — pick a subject\n` +
        `/docs — list docs\n` +
        `/doc <n> — pick a doc\n` +
        `/status — what's selected\n` +
        `/clear — wipe chat history\n` +
        `/help — this list\n\n` +
        `Pick a doc, then just type your question.`,
    );
  }

  private async handleMessage(ctx: Context) {
    const telegramId = ctx.from!.id;
    const userText = (ctx.message as { text: string }).text;

    const session = await this.requireLinked(ctx);
    if (!session) return;

    if (!session.activeSubjectId || !session.activeSessionId) {
      return ctx.reply(
        'No doc selected yet.\n\n' +
          '1. /subjects\n' +
          '2. /use <n>\n' +
          '3. /docs\n' +
          '4. /doc <n>\n\n' +
          'Then ask away.',
      );
    }

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

      history.push({ role: 'user', content: userText });
      history.push({ role: 'assistant', content: reply });
      this.histories.set(telegramId, history.slice(-20));

      await ctx.reply(reply);
    } catch {
      await ctx.reply("Couldn't answer that. Try again.");
    }
  }

  private async requireLinked(ctx: Context) {
    const session = await this.sessions.getSession(ctx.from!.id);
    if (session) return session;

    await ctx.reply(
      "Not linked yet. Grab a token in the web app (profile → Get link token), then send:\n\n/link <token>",
    );
    return null;
  }
}

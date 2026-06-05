import { InternalServerErrorException } from '@nestjs/common';
import { Notes } from '../notes/interfaces/notes.interface';
import { Quiz } from '../quiz/interfaces/quiz.interface';

export function parseNotesResponse(raw: string): Notes {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new InternalServerErrorException('Notes came back garbled. Try again.');
  }

  try {
    return JSON.parse(jsonMatch[0]) as Notes;
  } catch {
    throw new InternalServerErrorException('Notes came back garbled. Try again.');
  }
}

export function parseQuizResponse(raw: string): Quiz {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new InternalServerErrorException('Quiz came back garbled. Try again.');
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as { questions?: Quiz } | Quiz;
    if (Array.isArray(parsed)) return parsed;
    if (parsed && 'questions' in parsed && Array.isArray(parsed.questions)) {
      return parsed.questions;
    }
  } catch {
    throw new InternalServerErrorException('Quiz came back garbled. Try again.');
  }

  throw new InternalServerErrorException('Quiz came back garbled. Try again.');
}

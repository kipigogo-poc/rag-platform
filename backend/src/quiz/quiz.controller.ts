import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { GenerateQuizDto } from './dto/generate-quiz.dto';
import { QuizService } from './quiz.service';
import { Quiz } from './interfaces/quiz.interface';

@ApiTags('quiz')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('quiz')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate a multiple-choice quiz from an ingested document',
  })
  @ApiResponse({
    status: 200,
    description: 'Structured JSON quiz array',
    schema: {
      example: [
        {
          question: 'What is the primary function of chlorophyll?',
          options: [
            { label: 'A', text: 'To absorb water from soil' },
            { label: 'B', text: 'To capture light energy for photosynthesis' },
            { label: 'C', text: 'To transport nutrients in the stem' },
            { label: 'D', text: 'To store excess glucose' },
          ],
          correctAnswer: 'B',
          explanation:
            'Chlorophyll absorbs sunlight — primarily blue and red wavelengths — and uses that energy to drive photosynthesis.',
        },
      ],
    },
  })
  async generate(
    @Body() dto: GenerateQuizDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Quiz> {
    return this.quizService.generateQuiz(dto, user.id);
  }
}

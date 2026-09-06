import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

/**
 * Builds the real dependency-injection graph.
 *
 * Every other test in this suite constructs services directly with mocked constructor
 * arguments, which proves the logic but says nothing about whether Nest can actually assemble
 * the application. A provider injected into a module that does not provide it compiles, passes
 * its unit tests, and then fails at boot — EmailService reached CohortInviteService that way,
 * and the only thing that noticed was the e2e job, which hung for forty minutes on an app that
 * never came up rather than failing with the error Nest had already produced.
 *
 * compile() resolves the graph without calling onModuleInit, so no database or Redis is
 * needed and this runs in the fast suite alongside everything else.
 */
describe('AppModule', () => {
  it('resolves every provider — no module is missing a dependency', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      // The one provider that reaches outside the process during construction.
      .overrideProvider(PrismaService)
      .useValue({ $connect: jest.fn(), $disconnect: jest.fn() })
      .compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  }, 60_000);
});

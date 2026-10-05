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
 * The transport is mocked rather than reached. compile() instantiates every provider, and
 * several of them open a Redis connection in their constructor, so an earlier version of this
 * file opened real sockets to verify something that has nothing to do with connectivity — and
 * left a Jest worker alive doing it. What is under test is whether Nest can resolve the graph,
 * which needs no server at the other end.
 */

// A permissive stub: any method returns a resolved promise. bullmq and ioredis between them
// call a long tail of methods during construction, and enumerating them would make this file
// break every time a dependency adds one.
const redisStub = new Proxy(
  {},
  {
    get: (_target, prop) => {
      if (prop === 'then') return undefined; // not a thenable
      if (prop === 'status') return 'ready';
      return jest.fn().mockResolvedValue(undefined);
    },
  },
);

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => redisStub),
  Redis: jest.fn().mockImplementation(() => redisStub),
}));

import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

describe('AppModule', () => {
  it('resolves every provider — no module is missing a dependency', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ $connect: jest.fn(), $disconnect: jest.fn() })
      .compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  }, 60_000);
});

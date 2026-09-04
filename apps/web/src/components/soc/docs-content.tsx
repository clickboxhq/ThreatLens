import type { ReactNode } from "react";

/**
 * The user guide's content, kept apart from the page that renders it.
 *
 * What is deliberately NOT here: which scenarios are false positives, the techniques any
 * scenario requires, and the thresholds the detection rules fire at. All three are answer keys
 * — a reader who knows a scenario's expected verdict has 10% of its grade for free, and one
 * who knows the required techniques has another 30%. Explaining *that* evidence and technique
 * tagging are graded helps people investigate properly; telling them the answers does not.
 */

export interface DocSection {
  id: string;
  title: string;
  blurb: string;
  body: ReactNode;
}

function P({ children }: { children: ReactNode }) {
  return <p className="text-[13.5px] leading-relaxed text-secondary">{children}</p>;
}

function H({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-6 text-[13px] font-semibold uppercase tracking-wider text-foreground first:mt-0">
      {children}
    </h3>
  );
}

function Steps({ items }: { items: { title: string; detail: string }[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {items.map((s, i) => (
        <li key={s.title} className="flex gap-3">
          <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-border bg-background text-[10.5px] font-semibold tabular-nums text-muted-foreground">
            {i + 1}
          </span>
          <div>
            <div className="text-[13.5px] font-medium text-foreground">{s.title}</div>
            <div className="text-[13px] leading-relaxed text-secondary">{s.detail}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Defs({ rows }: { rows: { term: string; def: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-border rounded-lg border border-border">
      {rows.map((r) => (
        <div key={r.term} className="grid gap-1 p-3 sm:grid-cols-[180px_1fr] sm:gap-4">
          <dt className="text-[13px] font-medium text-foreground">{r.term}</dt>
          <dd className="text-[13px] leading-relaxed text-secondary">{r.def}</dd>
        </div>
      ))}
    </dl>
  );
}

function Callout({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-[color:var(--info)]/30 bg-[color:var(--info)]/5 p-3 text-[13px] leading-relaxed text-secondary">
      {children}
    </div>
  );
}

export const DOC_SECTIONS: DocSection[] = [
  {
    id: "getting-started",
    title: "Getting started",
    blurb: "What ThreatLens is and how to run your first investigation.",
    body: (
      <div className="flex flex-col gap-4">
        <P>
          ThreatLens gives you realistic security incidents to investigate. Each one generates its
          own set of logs — sign-ins, processes, emails, network traffic — and asks you to work out
          what happened, the way an analyst would on a real shift.
        </P>
        <P>
          Every scenario is generated fresh for you. Two people running the same scenario see the
          same story play out across different accounts, machines and timestamps, so there is
          nothing to memorise and nothing to copy.
        </P>
        <H>Your first run</H>
        <Steps
          items={[
            {
              title: "Verify your email",
              detail:
                "You can explore without it, but scored investigations stay locked until your address is confirmed. If the email has not arrived, resend it from the banner on your dashboard.",
            },
            {
              title: "Pick a scenario",
              detail:
                "Open the Scenario Library and choose one tagged Beginner. They are shorter and the story is easier to follow, which makes the feedback more useful on a first attempt.",
            },
            {
              title: "Start the investigation",
              detail:
                "Launching generates the telemetry and runs the detections over it. That takes a few seconds, then your alerts appear.",
            },
            {
              title: "Work the case, then submit",
              detail:
                "Investigate, pin what matters, commit to a verdict and submit. Your score comes back with a breakdown of where the marks went.",
            },
          ]}
        />
        <Callout>
          Nothing is timed and nothing is lost if you stop. Sessions stay open for several hours and
          you can leave one and come back to it.
        </Callout>
      </div>
    ),
  },
  {
    id: "investigating",
    title: "Working an investigation",
    blurb: "From an alert to a verdict, and what to do at each step.",
    body: (
      <div className="flex flex-col gap-4">
        <P>
          An investigation starts with alerts. Alerts are signals, not conclusions — some lead to a
          real attack, some are innocent activity that happened to look suspicious. Working out
          which is which is the job.
        </P>
        <H>The loop</H>
        <Steps
          items={[
            {
              title: "Read the alert, then leave it",
              detail:
                "The alert tells you where to start looking. It does not tell you what happened, and it is not evidence on its own.",
            },
            {
              title: "Pivot into the portals",
              detail:
                "Follow the accounts, machines and addresses the alert names into Identity, Endpoint, Email and Network. Most cases only make sense once you have looked at more than one.",
            },
            {
              title: "Pin evidence as you go",
              detail:
                "When you find a log line that matters, pin it. Pinning is how you show your work, and it builds your timeline for you rather than making you reconstruct it at the end.",
            },
            {
              title: "Tag the techniques you can support",
              detail:
                "Tag the ATT&CK techniques your evidence actually demonstrates. Tagging everything plausible scores worse than tagging only what you can back up.",
            },
            {
              title: "Take a response action if one is warranted",
              detail:
                "Isolating a device or a similar containment step is part of handling a real incident, and part of how the case is assessed.",
            },
            {
              title: "Commit to a verdict and submit",
              detail:
                "Close the incident with your verdict and a short summary of your reasoning, then submit the session for scoring.",
            },
          ]}
        />
        <H>Choosing a verdict</H>
        <Defs
          rows={[
            {
              term: "True positive",
              def: "Something genuinely malicious happened, and the alert was right to fire.",
            },
            {
              term: "False positive",
              def: "The activity was never suspicious once you understood it. The detection misread ordinary behaviour.",
            },
            {
              term: "Benign positive",
              def: "The detection was correct about what it saw, but the activity was authorised — real, expected, and not an attack.",
            },
          ]}
        />
        <Callout>
          Not every scenario is an attack. Escalating everything is its own kind of mistake, and
          some cases are there to be closed rather than escalated. Decide from the evidence, not
          from the fact that an alert fired.
        </Callout>
      </div>
    ),
  },
  {
    id: "scoring",
    title: "How you are scored",
    blurb: "What the five components measure and why the verdict is only part of it.",
    body: (
      <div className="flex flex-col gap-4">
        <P>
          Scoring happens on the server after you submit, and it grades the investigation rather
          than the guess. The verdict alone is a small part of the mark — reaching the right answer
          without evidence behind it does not score well, because that is not a result you could
          defend.
        </P>
        <Defs
          rows={[
            {
              term: "Technique accuracy · 30%",
              def: "The ATT&CK techniques you tagged, against the ones the case actually demonstrates. Both misses and wrong additions cost you, so over-tagging is not free.",
            },
            {
              term: "Evidence · 30%",
              def: "How much of the activity that mattered you pinned, and how much you missed.",
            },
            {
              term: "False-positive handling · 15%",
              def: "Whether you correctly left innocent activity alone instead of sweeping it in.",
            },
            {
              term: "Response actions · 15%",
              def: "Whether the containment steps you took suited what you were dealing with.",
            },
            {
              term: "Verdict · 10%",
              def: "Your final call on the incident.",
            },
          ]}
        />
        <H>Hints</H>
        <P>
          Hints are always available and never limited. Each one applies a small deduction, and they
          reveal progressively — a nudge toward where to look before anything more specific. Being
          stuck and giving up costs you more than taking the deduction.
        </P>
        <H>After scoring</H>
        <P>
          Your breakdown shows where the marks went, including evidence you missed. Skill Radar and
          the ATT&CK Explorer aggregate this across every session, so you can see which tactics you
          are consistently strong or weak on rather than judging by one result.
        </P>
      </div>
    ),
  },
  {
    id: "workspace",
    title: "Your workspace",
    blurb: "What each area of the sidebar is for.",
    body: (
      <div className="flex flex-col gap-4">
        <H>Investigations</H>
        <Defs
          rows={[
            {
              term: "Dashboard",
              def: "Your current work, recent scores and what to pick up next.",
            },
            {
              term: "Alert Center",
              def: "Everything the detections raised in the current session.",
            },
            {
              term: "Incident Queue",
              def: "Alerts you have promoted into incidents you are working.",
            },
            {
              term: "Case Management",
              def: "The full case view — evidence, timeline, notes and verdict in one place.",
            },
            {
              term: "Global Timeline",
              def: "Everything you have pinned, in order, across every entity.",
            },
            { term: "Evidence Locker", def: "Every item you have pinned in this session." },
            {
              term: "Investigation Graph",
              def: "The relationships between accounts, machines and addresses as a picture.",
            },
            { term: "Closed Alerts & Cases", def: "What you have already resolved." },
          ]}
        />
        <H>Investigation portals</H>
        <P>
          Each portal is one source of truth, the way separate consoles are on a real team. Most
          cases need more than one, and the pivot between them is usually where the answer is.
        </P>
        <Defs
          rows={[
            {
              term: "Identity Center",
              def: "Accounts, sign-ins, locations, MFA results and directory changes.",
            },
            {
              term: "Endpoint Center",
              def: "Machines, the processes that ran on them and the files they touched.",
            },
            { term: "Network Center", def: "Connections and traffic to and from the estate." },
            {
              term: "Email Investigation",
              def: "Mailboxes, full message headers, authentication results and attachments.",
            },
            {
              term: "Threat Intelligence",
              def: "Reputation and context for the addresses and domains you encounter.",
            },
            {
              term: "Global Search",
              def: "Search across accounts and mail when you have an identifier but no starting point.",
            },
            {
              term: "Log Explorer",
              def: "Raw log lines when you want the underlying record rather than a summarised view.",
            },
          ]}
        />
        <H>Learning</H>
        <Defs
          rows={[
            {
              term: "Scenario Library",
              def: "Everything you can run, by category and difficulty.",
            },
            {
              term: "Learning Center",
              def: "Structured courses and paths that sequence scenarios for you.",
            },
            {
              term: "MITRE ATT&CK Explorer",
              def: "The technique reference, and your own mastery per technique.",
            },
            {
              term: "Achievements",
              def: "Milestones for accuracy, evidence quality and technique breadth.",
            },
            { term: "Certificates", def: "Awards you have earned and can share." },
            { term: "Leaderboard", def: "Standings, where your cohort or organisation has one." },
          ]}
        />
      </div>
    ),
  },
  {
    id: "instructors",
    title: "For instructors",
    blurb: "Cohorts, groups, staffing and marking.",
    body: (
      <div className="flex flex-col gap-4">
        <P>
          A cohort is a group of learners you teach together. Students join with a code, you assign
          scenarios, and their submitted work arrives in your review queue.
        </P>
        <H>Staffing a cohort</H>
        <P>Cohorts can have more than one member of staff, in three roles:</P>
        <Defs
          rows={[
            { term: "Lead", def: "Full control, including adding and removing other staff." },
            {
              term: "Tutor",
              def: "Teaches the whole cohort — assignments, review queue and feedback.",
            },
            { term: "Group tutor", def: "The same, but only for the groups they are assigned to." },
          ]}
        />
        <Callout>
          A cohort must always keep at least one lead. Removing or demoting the last one is refused,
          because only a lead can add staff — a cohort without one cannot be administered by anyone.
        </Callout>
        <H>Groups</H>
        <P>
          Groups split a cohort into smaller sets — seminar groups, or streams moving at different
          paces. They are optional: a cohort works perfectly well without them. Once you have groups
          you can put a tutor in charge of specific ones, and assign work to a single group rather
          than everybody.
        </P>
        <P>
          Place students into groups from the roster in the Instructor Portal, and target an
          assignment at a group from the Assessments page. An assignment with no group set goes to
          the whole cohort.
        </P>
        <H>Marking</H>
        <P>
          Scoring is automatic, and your feedback sits alongside it rather than replacing it. You
          can comment, adjust rubric components, and reopen a session if a student should have
          another attempt.
        </P>
      </div>
    ),
  },
  {
    id: "account",
    title: "Account and help",
    blurb: "Profile, security and getting in touch.",
    body: (
      <div className="flex flex-col gap-4">
        <H>Your profile</H>
        <P>
          Update your name, role, bio and picture in Settings. Your display name is what appears on
          leaderboards, certificates and to your instructors.
        </P>
        <H>Security</H>
        <Defs
          rows={[
            {
              term: "Two-factor authentication",
              def: "Available to everyone and recommended. Save your recovery codes somewhere safe when you switch it on — they are shown once.",
            },
            {
              term: "Lost your authenticator",
              def: "Use the password reset link. Completing a reset also clears two-factor, so you can get back in.",
            },
            {
              term: "Signing out everywhere",
              def: "Changing your password ends every other active session.",
            },
          ]}
        />
        <H>Still stuck?</H>
        <P>
          Email{" "}
          <a
            href="mailto:info@useclickbox.com"
            className="text-[color:var(--info)] hover:underline"
          >
            info@useclickbox.com
          </a>{" "}
          and tell us what you were doing and what you expected to happen.
        </P>
      </div>
    ),
  },
];

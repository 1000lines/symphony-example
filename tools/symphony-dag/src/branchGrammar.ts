export type BranchParseErrorCode =
  | "malformed-ticket"
  | "malformed-task-branch"
  | "duplicate-ticket"
  | "unsorted-tickets";

export class BranchParseError extends Error {
  constructor(
    readonly code: BranchParseErrorCode,
    message: string,
    readonly input: string
  ) {
    super(message);
    this.name = "BranchParseError";
  }
}

export type ParsedTicket = {
  readonly id: string;
  readonly prefix: string;
  readonly number: number;
};

export type ParsedDagTaskBranch = {
  readonly branchName: string;
  readonly projectCode: string;
  readonly ticket: ParsedTicket;
  readonly slug: string;
};

const TICKET_PATTERN = /^([A-Z][A-Z0-9]*)-([1-9][0-9]*)$/;
const PROJECT_CODE_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const BRANCH_SLUG_SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function parseTicket(input: string): ParsedTicket {
  const match = TICKET_PATTERN.exec(input);
  if (!match) {
    throw new BranchParseError(
      "malformed-ticket",
      `Malformed ticket: ${input}`,
      input
    );
  }

  return {
    id: input,
    prefix: match[1],
    number: Number.parseInt(match[2], 10),
  };
}

export function isTicket(input: string): boolean {
  return TICKET_PATTERN.test(input);
}

export function compareTickets(
  left: string | ParsedTicket,
  right: string | ParsedTicket
): number {
  const parsedLeft = typeof left === "string" ? parseTicket(left) : left;
  const parsedRight = typeof right === "string" ? parseTicket(right) : right;

  const prefixComparison = parsedLeft.prefix.localeCompare(parsedRight.prefix);
  if (prefixComparison !== 0) {
    return prefixComparison;
  }

  return parsedLeft.number - parsedRight.number;
}

export function sortTickets(tickets: readonly string[]): readonly string[] {
  const parsedTickets = parseTicketSequence(tickets, {
    input: tickets.join(" "),
    requireSorted: false,
  });

  return [...parsedTickets].sort(compareTickets).map((ticket) => ticket.id);
}

export function parseDagTaskBranch(branchName: string): ParsedDagTaskBranch {
  const parts = branchName.split("/");
  const [namespace, projectCode, ticketPart, ...slugParts] = parts;
  if (
    parts.length < 4 ||
    namespace !== "symphony" ||
    !PROJECT_CODE_PATTERN.test(projectCode) ||
    !slugParts.every(isBranchSlugSegment)
  ) {
    throw new BranchParseError(
      "malformed-task-branch",
      `Malformed DAG task branch: ${branchName}`,
      branchName
    );
  }

  let ticket: ParsedTicket;
  try {
    ticket = parseTicket(ticketPart);
  } catch {
    throw new BranchParseError(
      "malformed-task-branch",
      `Malformed DAG task branch: ${branchName}`,
      branchName
    );
  }

  return {
    branchName,
    projectCode,
    ticket,
    slug: slugParts.join("/"),
  };
}

export function formatDagTaskBranchName(options: {
  readonly projectCode: string;
  readonly ticket: string;
  readonly slug: string;
}): string {
  if (!PROJECT_CODE_PATTERN.test(options.projectCode)) {
    throw new BranchParseError(
      "malformed-task-branch",
      `Malformed DAG project code: ${options.projectCode}`,
      options.projectCode
    );
  }

  parseTicket(options.ticket);
  const slugParts = options.slug.split("/");
  if (slugParts.length === 0 || !slugParts.every(isBranchSlugSegment)) {
    throw new BranchParseError(
      "malformed-task-branch",
      `Malformed DAG task branch slug: ${options.slug}`,
      options.slug
    );
  }

  return `symphony/${options.projectCode}/${options.ticket}/${options.slug}`;
}

export function parseTicketSequence(
  tickets: readonly string[],
  options: {
    readonly input: string;
    readonly requireSorted: boolean;
  }
): readonly ParsedTicket[] {
  if (tickets.length === 0) {
    throw new BranchParseError(
      "malformed-ticket",
      "Expected at least one ticket",
      options.input
    );
  }

  const parsedTickets = tickets.map(parseTicket);
  const seenTicketIds = new Set<string>();
  for (const ticket of parsedTickets) {
    if (seenTicketIds.has(ticket.id)) {
      throw new BranchParseError(
        "duplicate-ticket",
        `Duplicate ticket: ${ticket.id}`,
        options.input
      );
    }
    seenTicketIds.add(ticket.id);
  }

  if (options.requireSorted) {
    for (let index = 1; index < parsedTickets.length; index += 1) {
      if (compareTickets(parsedTickets[index - 1], parsedTickets[index]) > 0) {
        throw new BranchParseError(
          "unsorted-tickets",
          "Tickets are not in canonical order",
          options.input
        );
      }
    }
  }

  return parsedTickets;
}

function isBranchSlugSegment(segment: string): boolean {
  return BRANCH_SLUG_SEGMENT_PATTERN.test(segment);
}

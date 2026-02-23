type CompanionInjectedMessage = {
  role?: "assistant" | "system" | "user";
  content: string;
};

const subscribers = new Set<(message: CompanionInjectedMessage) => void>();
const queue: CompanionInjectedMessage[] = [];

export function emitCompanionMessage(message: CompanionInjectedMessage) {
  if (subscribers.size === 0) {
    queue.push(message);
    return;
  }

  subscribers.forEach((subscriber) => {
    subscriber(message);
  });
}

export function subscribeToCompanionMessages(
  handler: (message: CompanionInjectedMessage) => void,
) {
  subscribers.add(handler);

  while (queue.length > 0) {
    const pending = queue.shift();
    if (pending) {
      handler(pending);
    }
  }

  return () => {
    subscribers.delete(handler);
  };
}

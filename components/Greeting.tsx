interface GreetingProps {
  firstName: string;
  createdAt: string;
}

export function Greeting({ firstName, createdAt }: GreetingProps) {
  const since = new Date(createdAt).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-bold">Привет, {firstName}!</h1>
      <p className="text-sm text-tg-hint">В Brawlmates с {since}</p>
    </div>
  );
}

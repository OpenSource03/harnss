type Task = {
  id: number;
  title: string;
  done: boolean;
};

const tasks: Task[] = [
  { id: 1, title: "Write code", done: true },
  { id: 2, title: "Run tests", done: false },
  { id: 3, title: "Ship release", done: false },
];

const completedCount = tasks.filter((task) => task.done).length;
const pendingTitles = tasks
  .filter((task) => !task.done)
  .map((task) => task.title)
  .join(", ");

console.log(`Completed tasks: ${completedCount}/${tasks.length}`);
console.log(`Pending: ${pendingTitles}`);

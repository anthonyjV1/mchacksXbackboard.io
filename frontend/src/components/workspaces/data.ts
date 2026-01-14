export type TaskStatus = "Active" | "In progress" | "Done"

export type Task = {
  id: string
  title: string
  team: string
  key: string
  category: string
  priority: "Low" | "Medium" | "High"
  status: TaskStatus
  createdAt: string
  updatedAt: string
  dueDate: string
}

export const tasks: Task[] = [
  {
    id: "1",
    title: "Multi-select in contact list",
    team: "Front end",
    key: "SNC-544",
    category: "Task",
    priority: "High",
    status: "In progress",
    createdAt: "Mar 16, 2024",
    updatedAt: "Mar 21, 2024",
    dueDate: "Mar 28, 2024",
  },
  // add more rows that match the screenshot content
]

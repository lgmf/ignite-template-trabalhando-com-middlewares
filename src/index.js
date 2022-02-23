const express = require("express");
const cors = require("cors");

const { v4: uuidv4, validate: validateId } = require("uuid");

const app = express();
app.use(express.json());
app.use(cors());

const users = [];

function findUserByUsername(username) {
  return users.find((user) => user.username === username);
}

function findUserById(userId) {
  return users.find((user) => user.id === userId);
}

function findUserTodoById(user, todoId) {
  return user.todos.find((todo) => todo.id === todoId);
}

function checksExistsUserAccount(request, response, next) {
  const {
    headers: { username },
  } = request;

  const user = findUserByUsername(username);

  if (!user) {
    return response.status(404).json({ error: "User not found" });
  }

  request.user = user;
  next();
}

function checksCreateTodosUserAvailability(request, response, next) {
  const { user } = request;

  if (!user.pro && user.todos.length >= 10) {
    return response
      .status(403)
      .json({ error: "Todo limit exceeded for current user plan" });
  }

  next();
}

function checksTodoExists(request, response, next) {
  const {
    headers: { username },
    params: { id: todoId },
  } = request;

  if (!validateId(todoId)) {
    return response.status(400).json({ error: "Invalid id" });
  }

  const user = findUserByUsername(username);

  if (!user) {
    return response.status(404).json({ error: "User not found" });
  }

  const todo = findUserTodoById(user, todoId);

  if (!todo) {
    return response.status(404).json({ error: "Todo not found" });
  }

  request.user = user;
  request.todo = todo;

  next();
}

function findUserByIdMiddleware(request, response, next) {
  const { id: userId } = request.params;

  if (!validateId(userId)) {
    return response.status(400).json({ error: "Invalid id" });
  }

  const user = findUserById(userId);

  if (!user) {
    return response.status(404).json({ error: "User not found" });
  }

  request.user = user;
  next();
}

app.post("/users", (request, response) => {
  const { name, username } = request.body;

  const usernameAlreadyExists = users.some(
    (user) => user.username === username
  );

  if (usernameAlreadyExists) {
    return response.status(400).json({ error: "Username already exists" });
  }

  const user = {
    id: uuidv4(),
    name,
    username,
    pro: false,
    todos: [],
  };

  users.push(user);

  return response.status(201).json(user);
});

app.get("/users/:id", findUserByIdMiddleware, (request, response) => {
  const { user } = request;

  return response.json(user);
});

app.patch("/users/:id/pro", findUserByIdMiddleware, (request, response) => {
  const { user } = request;

  if (user.pro) {
    return response
      .status(400)
      .json({ error: "Pro plan is already activated." });
  }

  user.pro = true;

  return response.json(user);
});

app.get("/todos", checksExistsUserAccount, (request, response) => {
  const { user } = request;

  return response.json(user.todos);
});

app.post(
  "/todos",
  checksExistsUserAccount,
  checksCreateTodosUserAvailability,
  (request, response) => {
    const { title, deadline } = request.body;
    const { user } = request;

    const newTodo = {
      id: uuidv4(),
      title,
      deadline: new Date(deadline),
      done: false,
      created_at: new Date(),
    };

    user.todos.push(newTodo);

    return response.status(201).json(newTodo);
  }
);

app.put("/todos/:id", checksTodoExists, (request, response) => {
  const { title, deadline } = request.body;
  const { todo } = request;

  todo.title = title;
  todo.deadline = new Date(deadline);

  return response.json(todo);
});

app.patch("/todos/:id/done", checksTodoExists, (request, response) => {
  const { todo } = request;

  todo.done = true;

  return response.json(todo);
});

app.delete(
  "/todos/:id",
  checksExistsUserAccount,
  checksTodoExists,
  (request, response) => {
    const { user, todo } = request;

    const todoIndex = user.todos.indexOf(todo);

    if (todoIndex === -1) {
      return response.status(404).json({ error: "Todo not found" });
    }

    user.todos.splice(todoIndex, 1);

    return response.status(204).send();
  }
);

module.exports = {
  app,
  users,
  checksExistsUserAccount,
  checksCreateTodosUserAvailability,
  checksTodoExists,
  findUserById: findUserByIdMiddleware,
};

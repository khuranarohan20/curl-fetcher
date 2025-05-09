// mock-server.js
const express = require("express");
const app = express();

app.get("/mock-api", (req, res) => {
  const offset = parseInt(req.query.offset || "0");
  const limit = parseInt(req.query.limit || "60");

  if (offset >= 360) return res.json([]); // simulate end

  const data = Array.from({ length: limit }, (_, i) => ({
    id: offset + i,
    value: `item-${offset + i}`,
  }));

  res.json({ collection: data });
});

app.listen(3001, () =>
  console.log("Mock API running at http://localhost:3001")
);

const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const databasePath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();
app.use(express.json());

let database = null;

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const convertStateDbObjectToResponseObject = (db0bject) => {
  return {
    stateId: db0bject.state_id,
    stateName: db0bject.state_name,
    population: db0bject.population,
  };
};

const convertDistrictDbObjectToResponseObject = (db0bject) => {
  return {
    districtId: db0bject.district_id,
    districtName: db0bject.district_name,
    stateId: db0bject.state_id,
    cases: db0bject.cases,
    cured: db0bject.cured,
    active: db0bject.active,
    deaths: db0bject.deaths,
  };
};

function authenticateToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
}

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'; `;
  const databaseUser = await database.get(selectUserQuery);
  if (databaseUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      databaseUser.password
    );
    if (isPasswordMatched === true) {
      const payload = {
        Username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `SELECT
    *
    FROM
    state; `;
  const statesArray = await database.all(getStatesQuery);
  response.send(
    statesArray.map((eachState) =>
      convertStateDbObjectToResponseObject(eachState)
    )
  );
});

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
        SELECT
            *
        FROM
            state
        WHERE
            state_id = ${stateId};`;
  const state = await database.get(getStateQuery);
  response.send(convertStateDbObjectToResponseObject(state));
});

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
        SELECT
            *
        FROM
            district
        WHERE
            district_id = ${districtId};`;
    const district = await database.get(getDistrictQuery);
    response.send(convertDistrictDbObjectToResponseObject(district));
  }
);

app.post("/districts/", authenticateToken, async (request, response) => {
    const { stateId, districtName, cases, cured, active, deaths } = request.body;
    const postDistrictQuery = `
        INSERT INTO district (state_id, district_name, cases, cured, active, deaths)
        VALUES (${stateId}, '${districtName}', ${cases}, ${cured}, ${active}, ${deaths});`;
    await database.run(postDistrictQuery);
    response.send("District Successfully Added");
});


app.delete("/districts/:districtId/", authenticateToken, async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
        DELETE FROM district
        WHERE district_id = ${districtId};`;
    await database.run(deleteDistrictQuery);
    response.send("District Removed");
});


app.put("/districts/:districtId/", authenticateToken, async (request, response) => {
    const { districtId } = request.params;
    const { districtName, stateId, cases, cured, active, deaths } = request.body;
    const updateDistrictQuery = `
        UPDATE district
        SET
            district_name = '${districtName}',
            state_id = ${stateId},
            cases = ${cases},
            cured = ${cured},
            active = ${active},
            deaths = ${deaths}
        WHERE district_id = ${districtId};`;
    await database.run(updateDistrictQuery);
    response.send("District Details Updated");
});


app.get("/states/:stateId/stats/", authenticateToken, async (request, response) => {
    const { stateId } = request.params;
    const getStateStatsQuery = `
        SELECT
            SUM(cases) AS totalCases,
            SUM(cured) AS totalCured,
            SUM(active) AS totalActive,
            SUM(deaths) AS totalDeaths
        FROM
            district
        WHERE
            state_id = ${stateId};`;
    const stats = await database.get(getStateStatsQuery);
    response.send({
        totalCases: stats.totalCases || 0,
        totalCured: stats.totalCured || 0,
        totalActive: stats.totalActive || 0,
        totalDeaths: stats.totalDeaths || 0
    });
});


module.exports = app;

// the API's URL
const apiURL = "https://01.gritlab.ax/api/graphql-engine/v1/graphql";

// my own userId in the grit:lab system
const ownID = 797;
const usernameQuery = `
        query {
            user(where: { id: { _eq: 797 }}) {
                login
            }
        }
    `;

const getLevelUpsQuery = `
query getLevelUps($userId: Int_comparison_exp){
    transaction(order_by: {amount:asc} , where:{ userId: $userId, type: {_eq:"level"}, createdAt:{ _gte: "2022-08-31"}}) {
        amount,
        createdAt,
        path
    }
}`;
const getLevelUpsVariables = { "userId": { "_eq": ownID } };

const getAllAuditsQuery = `
query getAuditRatio($offset: Int){
  transaction(limit: 50, offset: $offset, where: { userId: { _eq: 797}, createdAt: { _gte: "2022-08-28"} _and: {
    _or: [ { type: { _eq: "up" }}, { type: { _eq: "down" }}]
  }}) {
    type
    object {
      id
      name
      type
      childrenAttrs
    }
    amount
    createdAt
  }
}`;
const getAllAuditsVariables = { "offset": 0}

const userName = document.getElementById("name");
const infoField = document.getElementById("info");

// queryFetch is the basic function that does the GraphQL queries based on the input query and optional variables
function queryFetch(query, variables) {
  return fetch(apiURL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: query,
      variables: variables,
    }),
  }).then((res) => res.json());
}

// updating the name header
function updateUsernameHeader() {
    return queryFetch(usernameQuery)
    .then((data) => {
        userName.innerText = data.data.user[0].login + " : grit:lab stats";
      });
}

// getting the level progression during the main curriculum
function getLevelProgression() {
  return queryFetch(getLevelUpsQuery, getLevelUpsVariables)
  .then((data) => {
    let queryRegex = new RegExp("piscine-(js|go).");
    let list = data.data.transaction;
    list = list.filter((record) => !queryRegex.test(record.path));
    return list;
  });
}

async function buildBasicInfo() {
    infoField.replaceChildren();
    let allLevels = await getLevelProgression();
    let highestLevel = allLevels[allLevels.length-1];
    infoField.innerText = "Current level: " + highestLevel.amount;
}

async function getAuditRatio(acc=undefined) {
  return queryFetch(getAllAuditsQuery, getAllAuditsVariables)
    .then(data => {
      console.log(data);
      let arr = data.data.transaction;
      let received = 0.0;
      let done = 0.0;
      for (let elem of arr) {
        if (elem.type === "up") {
          received += elem.amount;
        } else if (elem.type === "down") {
          done += elem.amount
        }
      }
      if (acc === undefined) {
        acc = [received, done];
      } else {
        acc[0] += received;
        acc[1] += done;
      }
      if (data.data.transaction.length !== 50) {
        getAllAuditsVariables.offset = 0;
        return (acc[0] / acc[1]).toFixed(1);
      } else {
        getAllAuditsVariables.offset += 50;
        return getAuditRatio(acc);
      }
    })
}

async function levelsOverTime() {
    let levels = await getLevelProgression();
    let maxLevel = Math.max.apply(Math, levels.map(function(record) { return record.amount }));
    infoField.replaceChildren();

    let margin = {top: 10, right: 30, bottom: 30, left: 60};
    let width = 460 - margin.left - margin.right;
    let height = 400 - margin.top - margin.bottom;

    let svg = d3.select("#info").append("svg").attr("width", 800).attr("height", 200)

    // parse the date / time
    let parseTime = d3.timeParse("%d-%b-%y");

    //set ranges
    var xScale = d3.scaleTime().range([0, width]);
    var yScale = d3.scaleLinear().range([height, 0]);

    let lineFunc = d3.line()
      .x(function(d) { return xScale(Date.parse(d.createdAt)) })
      .y(function(d) { return yScale(d.amount) });

    svg.append("path")
      .attr("d", lineFunc(levels))
      .attr("stroke", "black")
      .attr("fill", "none");
}

window.onload = function () {
  document.getElementById("home-screen").addEventListener("click", () => {
    buildBasicInfo();
  })
  document.getElementById("level-graph-button").addEventListener("click", () => {
    levelsOverTime();
  })
  updateUsernameHeader();
  buildBasicInfo();
  getAuditRatio().then(data => {
    console.log("ratio: ", data);
  })
};

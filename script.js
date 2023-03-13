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
        type,
        amount,
        objectId,
        userId,
        createdAt,
        path
    }
}`;
const getLevelUpsVariables = { userId: { _eq: ownID } };

const userName = document.getElementById("name");

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
        userName.innerText = data.data.user[0].login;
      });
}

// getting the level progression during the main curriculum
function getLevelProgression() {
  return queryFetch(getLevelUpsQuery, getLevelUpsVariables)
  .then((data) => {
    let queryRegex = new RegExp("piscine-(js|go).");
    let list = data.data.transaction;
    list = list.filter((record) => !queryRegex.test(record.path));
    console.log(list);
  });
}

window.onload = function () {
  updateUsernameHeader();
  getLevelProgression();
};

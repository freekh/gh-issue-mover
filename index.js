const octokit = require('@octokit/rest')();

const { API_TOKEN } = process.env;
const FROM_REPO_OWNER = process.argv[2];
const TO_REPO_OWNER = process.argv[3];

if (!API_TOKEN) {
  throw Error('API_TOKEN env var missing.');
}
if (!FROM_REPO_OWNER || !TO_REPO_OWNER) {
  throw Error('Missing parameters! Usage: ./index <OWNER/REPO> ');
}

const baseParams = param => {
  const [ owner, repo ] = param.split('/');
  return {
    owner, repo,
  };
};

const fromRepoParams = baseParams(FROM_REPO_OWNER);
const toRepoParams = baseParams(TO_REPO_OWNER);

octokit.authenticate({
  type: 'app',
  token: API_TOKEN,
});

const main = async () => {
  const state = 'open';
  const { data: issues } =
    await octokit.issues.getForRepo({
      ...fromRepoParams,
      state
  });
  const issuesAndComments = await Promise.all(issues.map(async (issue) => {
    const { data: comments } = await octokit.issues.getComments({
      ...fromRepoParams,
      number: issue.number,
    });
    return {
      ...issue,
      comments: comments.map(comment => ({
        ...comment,
        body: `@${comment.user.login} wrote in https://github.com/${fromRepoParams.owner}/${fromRepoParams.repo}/issues/${issue.number}:\n${comment.body}`,
      })).concat({
        body: `Issue and comments moved from https://github.com/${fromRepoParams.owner}/${fromRepoParams.repo}/issues/${issue.number}`,
      }),
    };
  }));
  await issuesAndComments.map(async ({ comments, body, title, labels }) => {
    const { data: { number } } = await octokit.issues.create({
      ...toRepoParams,
      body,
      title,
      labels: labels.map(({ name }) => name).reduce((prev, curr) => {
        if (prev.indexOf(curr) === -1) {
          return prev.concat(curr);
        }
        return prev;
      }, []),
    });
    for (let { body } of comments) {
      await octokit.issues.createComment({
        ...toRepoParams,
        body,
        number
      })
    }
  });
};

main();

import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import fs from 'fs';

async function test() {
  try {
    await git.clone({
      fs,
      http,
      dir: './test-repo',
      url: 'https://github.com/nonexistent/repo-xyz-123.git',
      depth: 1,
    });
  } catch (error: any) {
    console.log("CLONE ERROR:", error);
    console.log("CLONE ERROR MESSAGE:", error.message);
  }
}
test();

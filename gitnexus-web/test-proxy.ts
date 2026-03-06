import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import fs from 'fs';

const HOSTED_PROXY_URL = 'https://gitnexus.vercel.app/api/proxy';

const createProxiedHttp = (): typeof http => {
  return {
    request: async (config) => {
      const proxyUrl = `${HOSTED_PROXY_URL}?url=${encodeURIComponent(config.url)}`;
      return http.request({ ...config, url: proxyUrl });
    },
  };
};

async function test() {
  try {
    const httpClient = createProxiedHttp();
    await git.clone({
      fs,
      http: httpClient,
      dir: './test-repo-proxy',
      url: 'https://github.com/nonexistent/repo-xyz-123.git',
      depth: 1,
    });
    console.log("SUCCESS");
  } catch (error: any) {
    console.log("CLONE ERROR:", error);
    console.log("CLONE ERROR MESSAGE:", error.message);
  }
}
test();

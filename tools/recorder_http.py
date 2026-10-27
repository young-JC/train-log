"""Private Site transport using Windows/system proxy settings; secrets via stdin only."""
import json
import sys
import urllib.error
import urllib.parse
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def main():
    try:
        data = json.load(sys.stdin)
        url = urllib.parse.urlsplit(data['url'])
        if url.scheme != 'https' or not url.hostname.endswith('.chatgpt.site') or url.username or url.password:
            raise ValueError('Invalid Site origin')
        body = data.get('body')
        request = urllib.request.Request(data['url'], data=body.encode('utf-8') if body is not None else None,
                                         headers=data.get('headers', {}), method=data.get('method', 'GET'))
        opener = urllib.request.build_opener(NoRedirect())
        try:
            response = opener.open(request, timeout=30)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            content = response.read(2000001)
            if len(content) > 2000000:
                raise ValueError('Response too large')
            print(json.dumps({'status': response.code, 'text': content.decode('utf-8', errors='replace')}))
    except Exception as error:
        # Do not print request URLs, headers, bearer tokens, or body on failure.
        print(json.dumps({'status': 0, 'error': type(error).__name__}))
        sys.exit(1)


if __name__ == '__main__':
    main()

from pathlib import Path
import json

p = Path('README.md')
p.write_text(p.read_text().replace('pythontests/', 'python tests/').replace('pythontools/', 'python tools/').replace('-rtests/', '-r tests/'))
p = Path('package.json')
data = json.loads(p.read_text())
data['devDependencies']['vite'] = '7.3.7'
data['scripts']['dev'] = 'vite --host 127.0.0.1'
data['scripts']['preview'] = 'vite preview --host 127.0.0.1'
p.write_text(json.dumps(data, indent=2) + '\n')
p = Path('tests/browser.py')
text = p.read_text()
text = text.replace("errors=[];p.on('pageerror',lambda e:errors.append(str(e)))", """errors=[]
    def page_error(error):
        detail = {'message':str(error), 'stack':error.stack, 'url':p.url}
        errors.append(detail)
        print('PAGE_ERROR',json.dumps(detail,ensure_ascii=False),flush=True)
        (out/'page-errors.json').write_text(json.dumps(errors,ensure_ascii=False,indent=2))
    p.on('pageerror',page_error)""")
assert "def page_error(error):" in text
text = text.replace("ok('no runtime exceptions',not errors)", "print('PAGE_ERRORS',json.dumps(errors,ensure_ascii=False),flush=True)\n    ok('no runtime exceptions',not errors)")
p.write_text(text)

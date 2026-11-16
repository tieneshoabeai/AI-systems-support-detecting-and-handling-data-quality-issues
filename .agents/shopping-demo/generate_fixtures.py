"""Read CSV and emit apply_patch text only; no filesystem writes."""
import csv,json,sys,pathlib,math,statistics,hashlib,collections,difflib
root=pathlib.Path(__file__).resolve().parents[2]
source=pathlib.Path('/Users/mac/Downloads/shopping_trends_corrupted_10pct.csv')
raw=list(csv.reader(source.open(encoding='utf-8-sig',newline='')))
columns,rows=raw[0],raw[1:]
target=root/'src/frontend/src/mocks/shopping-trends'
numeric={'Customer ID':None,'Age':(0,120),'Purchase Amount (USD)':(0,None),'Review Rating':(1,5),'Previous Purchases':(0,None)}
allowed={
'Gender':['Male','Female'],
'Category':['Clothing','Footwear','Outerwear','Accessories'],
'Size':['S','M','L','XL'],
'Season':['Spring','Summer','Fall','Winter'],
'Subscription Status':['Yes','No'],
'Discount Applied':['Yes','No'],
'Promo Code Used':['Yes','No'],
'Payment Method':['Venmo','Cash','Credit Card','PayPal','Bank Transfer','Debit Card'],
'Shipping Type':['Express','Free Shipping','Next Day Air','Standard','2-Day Shipping','Store Pickup'],
'Frequency of Purchases':['Fortnightly','Weekly','Bi-Weekly','Monthly','Quarterly','Annually','Every 3 Months']}
nulls={'na','n/a','none','null','undefined','-'}
# Dataset-specific candidate dictionaries. These are demo hypotheses, not BE schema.
for column,rejected in {
 'Item Purchased':{'???','Item_404','Unknown_Product'},
 'Color':{'Color_404','Invisible','Unknown_Color'},
 'Location':{'Atlantis','N/A_LOCATION','Unknown_Location'},
}.items():
 j=columns.index(column)
 allowed[column]=sorted({row[j] for row in rows}-{'' ,'NaN'}-rejected)
findings=[]
stats=[]
def add(i,j,kind,reason,origin):
 findings.append(dict(row=i+1,csvLine=i+2,column=columns[j],value=rows[i][j],kind=kind,reason=reason,origin=origin))
def quantile(xs,p):
 pos=(len(xs)-1)*p; n=int(pos); return xs[n]+(pos-n)*(xs[min(n+1,len(xs)-1)]-xs[n])
for j,c in enumerate(columns):
 values=[v[j] for v in rows]; nums=[]; missing=0
 for i,v in enumerate(values):
  t=v.strip()
  if not t:
   missing+=1; add(i,j,'missing','Giá trị rỗng hoặc chỉ có khoảng trắng','BE DQ01'); continue
  if t.lower()=='nan' or t.lower() in nulls:
   add(i,j,'nan' if t.lower()=='nan' else 'missing_symbol','Ký hiệu không có giá trị; giữ nguyên raw string','demo classification / BE DQ03 symbols'); continue
  if c in numeric:
   try: n=float(t)
   except ValueError: n=float('nan')
   if not math.isfinite(n):
    add(i,j,'invalid_type','Không chuyển được thành số hữu hạn','BE DQ03'); continue
   nums.append((i,n))
   bounds=numeric[c]
   if bounds and (n<bounds[0] or bounds[1] is not None and n>bounds[1] or c in ['Age','Previous Purchases'] and not n.is_integer()):
    add(i,j,'invalid_domain','Ngoài miền demo: '+str(bounds)+('; số nguyên' if c in ['Age','Previous Purchases'] else ''),'demo-proposal')
  elif c in allowed and t not in allowed[c]:
   add(i,j,'invalid_category','Không thuộc danh sách nhãn demo: '+', '.join(allowed[c]),'demo-proposal')
 frequencies=collections.Counter(v for v in values if v.strip())
 s=dict(column=c,type='number' if c in numeric else 'string',missing=missing,unique=len(set(values)),top=[dict(value=k,count=n) for k,n in frequencies.most_common(6)])
 if nums:
  ns=sorted(v for _,v in nums); q1=quantile(ns,.25);q3=quantile(ns,.75);iqr=q3-q1
  s.update(validNumeric=len(ns),minimum=min(ns),maximum=max(ns),mean=round(statistics.mean(ns),4),median=statistics.median(ns),q1=q1,q3=q3,iqrBounds=[q1-1.5*iqr,q3+1.5*iqr])
  if c!='Customer ID' and len(ns)>=4 and iqr>0:
   for i,n in nums:
    if n<q1-1.5*iqr or n>q3+1.5*iqr: add(i,j,'outlier','Ngoài [Q1 − 1.5 IQR, Q3 + 1.5 IQR]; cần xem xét, chưa kết luận sai','BE DQ04')
 stats.append(s)
groups=collections.defaultdict(list)
for i,row in enumerate(rows): groups[tuple(row)].append(i)
for ix in groups.values():
 if len(ix)>1:
  for i in ix[1:]: findings.append(dict(row=i+1,csvLine=i+2,column='*',value=' | '.join(rows[i]),kind='duplicate',reason='Trùng toàn bộ cột với bản ghi '+str(ix[0]+1),origin='BE DQ02'))
findings.sort(key=lambda x:(x['row'],columns.index(x['column']) if x['column'] in columns else -1,x['kind']))
meta=dict(fileName=source.name,bytes=source.stat().st_size,rows=len(rows),columns=columns,sha256=hashlib.sha256(source.read_bytes()).hexdigest())
owner=dict(id='demo-user',name='Demo Analyst',role='Owner',initials='DA',email='demo@shopping.test')
project=dict(id='shopping-trends',code='SHOP-001',name='Shopping Trends',description='Phân tích chất lượng dữ liệu mua sắm từ CSV 3.900 dòng.',status='active',workspaceId='shopping-workspace',workspaceName='Shopping Demo',cover='cyan',dataset=dict(id='shopping-data',fileName=source.name,format='CSV',rows=len(rows),columns=len(columns),sizeMb=source.stat().st_size/1048576,importedAt='2026-11-14T00:00:00.000Z',status='processed'),members=[owner],createdAt='2026-11-14T00:00:00.000Z',updatedAt='2026-11-14T00:00:00.000Z',owner=owner)
workspace=dict(id='shopping-workspace',name='Shopping Demo',description='Dữ liệu shopping dùng thử offline',status='active',projects=1,datasets=1,members=3,storageGb=0,favorite=True,cover='cyan',createdAt=project['createdAt'],updatedAt=project['updatedAt'],owner=owner,memberPreview=[owner,dict(id='shopping-member',name='Demo Member',role='Member',initials='DM',email='member@shopping.test'),dict(id='shopping-viewer',name='Demo Viewer',role='Viewer',initials='DV',email='viewer@shopping.test')])
arg=sys.argv[1]
if arg.startswith('records-'):
 index=int(arg.split('-')[1]); data=rows[index*500:(index+1)*500]; name=arg+'.json'
elif arg=='dataset': data=meta;name='dataset.json'
elif arg=='project': data=dict(project=project,workspace=workspace);name='project.json'
elif arg=='auth': data=dict(email='demo@shopping.test',password='Demo12345!',user=dict(id='demo-user',email='demo@shopping.test',firstName='Demo',lastName='Analyst',role='analyst',status='active',avatarUrl=None));name='auth.json'
elif arg=='analysis': data=dict(columns=stats,missingCells=sum(x['missing'] for x in stats),duplicateRows=sum(max(0,len(x)-1) for x in groups.values()),rules=dict(numeric=numeric,categorical=allowed),notes=['Mean/min/max gồm mọi số hữu hạn, kể cả số sai miền và outlier.','Miền categorical và miền số demo là đề xuất, không phải schema nghiệp vụ đã xác minh.','Customer ID không dùng để tìm outlier vì là định danh.']);name='analysis.json'
else: data=dict(counts={**dict.fromkeys(['missing','nan','missing_symbol','invalid_type','invalid_domain','invalid_category','duplicate','outlier'],0),**dict(collections.Counter(x['kind'] for x in findings))},affectedRows=len(set(x['row'] for x in findings)),findingCount=len(findings),items=findings);name='detection.json'
body=json.dumps(data,ensure_ascii=False,allow_nan=False,separators=(',',':'))
destination=target/name
if destination.exists():
 old=destination.read_text()
 diff=list(difflib.unified_diff(old.splitlines(),[body],n=3))[2:]
 print('*** Begin Patch\n*** Update File: '+str(destination)+'\n'+'\n'.join('@@' if line.startswith('@@') else line for line in diff)+'\n*** End Patch')
else:
 print('*** Begin Patch\n*** Add File: '+str(destination)+'\n+'+body+'\n*** End Patch')


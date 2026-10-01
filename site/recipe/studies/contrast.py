import json
def lin(c):
    c=c/255
    return c/12.92 if c<=0.04045 else ((c+0.055)/1.055)**2.4
def lum(h):
    h=h.lstrip('#'); r,g,b=int(h[0:2],16),int(h[2:4],16),int(h[4:6],16)
    return 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b)
def cr(a,b):
    la,lb=lum(a),lum(b); hi,lo=max(la,lb),min(la,lb); return (hi+0.05)/(lo+0.05)
stock='#E9E5DD'; stock_deep='#DCD7CE'; ink='#221F1C'; ink_muted='#6B655C'; rule='#C9C3B8'
accents={'ultramarine-a':'#1F3BC3','ultramarine-b':'#2240C9','ikb':'#002FA7','ultramarine-c':'#1A35B5'}
inks={'oxblood':'#7A2E2E','rust':'#8C4A22','ochre':'#8A6414','moss':'#4F6A2E','teal':'#2B6A6A','slate':'#44586F','indigo':'#3F3A8C','plum':'#6E3A62','graphite':'#4A4642','bottle':'#2F5243'}
out={}
print('ink on stock', round(cr(ink,stock),2)); print('ink on stock_deep', round(cr(ink,stock_deep),2))
print('ink_muted on stock', round(cr(ink_muted,stock),2)); print('rule on stock', round(cr(rule,stock),2))
for k,v in accents.items(): print('accent',k,'on stock',round(cr(v,stock),2),'| stock text on it',round(cr(stock,v),2))
print('--- case inks: stock text on ink')
for k,v in inks.items():
    out[k]=round(cr(stock,v),2); print(f'{k:10} {v} {out[k]}')

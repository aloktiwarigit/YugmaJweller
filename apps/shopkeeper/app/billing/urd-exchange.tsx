import React, { useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Alert, StyleSheet, ActivityIndicator, Share } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../src/api/client';

interface UrdPurchaseResponse {
  id: string; shopId: string; customerId: string | null; customerName: string;
  customerPhone: string | null; metalType: string; purity: string; weightG: string;
  agreedRatePaise: string; goldValuePaise: string; rcmGstPaise: string;
  netToCustomerPaise: string; selfInvoiceNumber: string; selfInvoiceText: string;
  linkedInvoiceId: string | null; recordedByUserId: string; createdAt: string;
}

type MetalType = 'GOLD' | 'SILVER';
const GOLD_PURITIES = ['24K','22K','20K','18K','14K'] as const;
const SILVER_PURITIES = ['999','925'] as const;

function formatPaise(paise: bigint): string {
  return `₹${(Number(paise)/100).toLocaleString('hi-IN',{minimumFractionDigits:2})}`;
}

function calcPreview(weightG: string, rate: string) {
  try {
    const w = parseFloat(weightG); const r = parseFloat(rate);
    if (!isFinite(w)||w<=0||!isFinite(r)||r<=0) return null;
    const g = BigInt(Math.floor(w*r)); const rcm = (g*300n)/10000n;
    return { goldValue: g, rcmGst: rcm, netToCustomer: g - rcm };
  } catch { return null; }
}

export default function UrdExchangeScreen(): JSX.Element {
  const [metal, setMetal] = useState<MetalType>('GOLD');
  const [purity, setPurity] = useState('22K');
  const [weightG, setWeightG] = useState('');
  const [rate, setRate] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState<UrdPurchaseResponse | null>(null);
  const mountedRef = useRef(true);
  const preview = calcPreview(weightG, rate);
  const purities = metal === 'GOLD' ? GOLD_PURITIES : SILVER_PURITIES;

  const recordMutation = useMutation<UrdPurchaseResponse, unknown, void>({
    mutationFn: async () => {
      const res = await api.post<UrdPurchaseResponse>('/api/v1/billing/urd-purchases', {
        customerName: name.trim(), customerPhone: phone.trim() || undefined,
        metalType: metal, purity, weightG: parseFloat(weightG).toFixed(4),
        agreedRatePaise: Math.round(parseFloat(rate)).toString(),
      });
      return res.data;
    },
    onSuccess: (data) => { if (mountedRef.current) setResult(data); },
    onError: (err) => {
      if (!mountedRef.current) return;
      const body = (err as { response?: { data?: unknown } }).response?.data;
      const detail = (body as { detail?: string }|null|undefined)?.detail ?? (err instanceof Error ? err.message : 'कुछ गलत हो गया');
      Alert.alert('URD खरीद नहीं हुई', detail);
    },
  });

  const handleSave = useCallback(() => {
    if (!name.trim()) { Alert.alert('जरूरी है', 'ग्राहक का नाम डालें।'); return; }
    if (!weightG||parseFloat(weightG)<=0) { Alert.alert('जरूरी है', 'वजन डालें।'); return; }
    if (!rate||parseFloat(rate)<=0) { Alert.alert('जरूरी है', 'दर डालें।'); return; }
    recordMutation.mutate();
  }, [name, weightG, rate, recordMutation]);

  const handleShare = useCallback(async () => {
    if (!result) return;
    try { await Share.share({ message: result.selfInvoiceText, title: result.selfInvoiceNumber }); }
    catch { /* cancelled */ }
  }, [result]);

  const CREAM='#F5EDDD', BROWN='#2C1810', GOLD='#B8860B';

  if (result) return (
    <ScrollView style={{ flex:1, backgroundColor:CREAM }} contentContainerStyle={{ padding:20 }}>
      <View style={{ backgroundColor:'#2D6A4F', borderRadius:10, padding:16, alignItems:'center', marginBottom:16 }}>
        <Text style={{ fontFamily:'NotoSansDevanagari', fontSize:18, color:'#FFF', fontWeight:'700' }}>✓ URD खरीद दर्ज हो गई</Text>
        <Text style={{ fontFamily:'NotoSansDevanagari', fontSize:13, color:'#B7E4C7', marginTop:4 }}>{result.selfInvoiceNumber}</Text>
      </View>
      <View style={{ backgroundColor:'#FFF8EE', borderRadius:10, borderWidth:1, borderColor:'#E8D5B0', padding:16, marginBottom:16 }}>
        <Text style={{ fontFamily:'NotoSansDevanagari', fontSize:15, color:BROWN, marginBottom:4 }}>
          सोने का मूल्य: <Text style={{ fontWeight:'700', color:GOLD }}>{formatPaise(BigInt(result.goldValuePaise))}</Text>
        </Text>
        <Text style={{ fontFamily:'NotoSansDevanagari', fontSize:15, color:BROWN, marginBottom:4 }}>
          RCM GST (3%): <Text style={{ fontWeight:'700', color:GOLD }}>{formatPaise(BigInt(result.rcmGstPaise))}</Text>
        </Text>
        <Text style={{ fontFamily:'NotoSansDevanagari', fontSize:17, color:BROWN, fontWeight:'700' }}>
          ग्राहक को देना: <Text style={{ color:GOLD }}>{formatPaise(BigInt(result.netToCustomerPaise))}</Text>
        </Text>
      </View>
      <View style={{ backgroundColor:'#FFF', borderRadius:8, borderWidth:1, borderColor:'#DDD', padding:12, marginBottom:16 }}>
        <Text style={{ fontFamily:'Courier', fontSize:11, color:'#333', lineHeight:16 }}>{result.selfInvoiceText}</Text>
      </View>
      <Pressable style={{ marginTop:12, backgroundColor:'#C8671E', borderRadius:10, paddingVertical:14, alignItems:'center' }} onPress={handleShare}>
        <Text style={{ fontFamily:'NotoSansDevanagari', fontSize:16, color:'#FFF', fontWeight:'600' }}>प्रिंट / शेयर करें</Text>
      </Pressable>
      <Pressable style={{ marginTop:12, backgroundColor:'transparent', borderWidth:2, borderColor:BROWN, borderRadius:10, paddingVertical:14, alignItems:'center' }} onPress={() => { setResult(null); setWeightG(''); setRate(''); setName(''); setPhone(''); }}>
        <Text style={{ fontFamily:'NotoSansDevanagari', fontSize:16, color:BROWN, fontWeight:'600' }}>नई URD खरीद</Text>
      </Pressable>
    </ScrollView>
  );

  return (
    <ScrollView style={{ flex:1, backgroundColor:CREAM }} contentContainerStyle={{ padding:20, paddingBottom:48 }}>
      <Text style={{ fontFamily:'NotoSansDevanagari', fontSize:14, color:'#666', marginTop:16, marginBottom:6 }}>धातु का प्रकार</Text>
      <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:8 }}>
        {(['GOLD','SILVER'] as MetalType[]).map(m => (
          <Pressable key={m}
            style={{ paddingHorizontal:16, paddingVertical:10, borderRadius:24, borderWidth:1.5, borderColor:BROWN, minWidth:48, minHeight:48, justifyContent:'center', alignItems:'center', backgroundColor: metal===m ? BROWN : 'transparent' }}
            onPress={() => { setMetal(m); setPurity(m==='GOLD' ? '22K' : '999'); }}
            accessibilityRole="radio" accessibilityState={{ selected: metal===m }}>
            <Text style={{ fontFamily:'NotoSansDevanagari', fontSize:15, color: metal===m ? '#FFF' : BROWN }}>
              {m==='GOLD' ? 'सोना' : 'चाँदी'}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={{ fontFamily:'NotoSansDevanagari', fontSize:14, color:'#666', marginTop:14, marginBottom:6 }}>शुद्धता (Purity)</Text>
      <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:8 }}>
        {purities.map(p => (
          <Pressable key={p}
            style={{ paddingHorizontal:16, paddingVertical:10, borderRadius:24, borderWidth:1.5, borderColor:BROWN, minHeight:48, justifyContent:'center', alignItems:'center', backgroundColor: purity===p ? BROWN : 'transparent' }}
            onPress={() => setPurity(p)} accessibilityRole="radio" accessibilityState={{ selected: purity===p }}>
            <Text style={{ fontFamily:'NotoSansDevanagari', fontSize:15, color: purity===p ? '#FFF' : BROWN }}>{p}</Text>
          </Pressable>
        ))}
      </View>
      {[
        { label:'ग्राहक का नाम *', value:name, onChangeText:setName, placeholder:'नाम लिखें', keyboardType:'default' as const },
        { label:'मोबाइल नंबर', value:phone, onChangeText:setPhone, placeholder:'10 अंक', keyboardType:'phone-pad' as const },
        { label:'वजन (ग्राम) *', value:weightG, onChangeText:setWeightG, placeholder:'जैसे: 15.0000', keyboardType:'decimal-pad' as const },
        { label:'दर (पैसे/ग्राम) *', value:rate, onChangeText:setRate, placeholder:'जैसे: 600000', keyboardType:'number-pad' as const },
      ].map(f => (
        <View key={f.label}>
          <Text style={{ fontFamily:'NotoSansDevanagari', fontSize:15, color:BROWN, marginTop:14, marginBottom:4 }}>{f.label}</Text>
          <TextInput style={{ borderWidth:1, borderColor:'#C4A882', borderRadius:8, paddingHorizontal:14, paddingVertical:12, fontSize:16, fontFamily:'NotoSansDevanagari', color:BROWN, backgroundColor:'#FFF', minHeight:48 }}
            value={f.value} onChangeText={f.onChangeText} placeholder={f.placeholder} keyboardType={f.keyboardType} />
        </View>
      ))}
      {preview && (
        <View style={{ marginTop:20, backgroundColor:'#FFF8EE', borderRadius:10, borderWidth:1, borderColor:'#E8D5B0', padding:16 }}>
          <Text style={{ fontFamily:'NotoSansDevanagari', fontSize:14, color:'#666', marginBottom:8 }}>अनुमानित हिसाब</Text>
          <Text style={{ fontFamily:'NotoSansDevanagari', fontSize:15, color:BROWN, marginBottom:4 }}>
            सोने का मूल्य: <Text style={{ fontWeight:'600', color:GOLD }}>{formatPaise(preview.goldValue)}</Text>
          </Text>
          <Text style={{ fontFamily:'NotoSansDevanagari', fontSize:15, color:BROWN, marginBottom:4 }}>
            RCM GST (3%): <Text style={{ fontWeight:'600', color:GOLD }}>{formatPaise(preview.rcmGst)}</Text>
          </Text>
          <Text style={{ fontFamily:'NotoSansDevanagari', fontSize:17, color:BROWN, fontWeight:'700' }}>
            ग्राहक को देना: <Text style={{ color:GOLD }}>{formatPaise(preview.netToCustomer)}</Text>
          </Text>
          <Text style={{ fontFamily:'NotoSansDevanagari', fontSize:12, color:'#888', marginTop:6 }}>* GST सरकार को ज्वैलर देगा (RCM)</Text>
        </View>
      )}
      <Pressable style={{ marginTop:24, backgroundColor: recordMutation.isPending ? '#999' : BROWN, borderRadius:10, paddingVertical:16, alignItems:'center', minHeight:56, justifyContent:'center' }}
        onPress={handleSave} disabled={recordMutation.isPending} accessibilityRole="button">
        {recordMutation.isPending ? <ActivityIndicator color='#FFF' /> : <Text style={{ fontFamily:'NotoSansDevanagari', fontSize:17, color:'#FFF', fontWeight:'600' }}>URD खरीद दर्ज करें</Text>}
      </Pressable>
    </ScrollView>
  );
}
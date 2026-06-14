from lxml import etree
import os

xsd_path = r'..\iso20022generatorbackend\app\sr2025\schemas\pain.008.001.08.xsd'
schema = etree.XMLSchema(etree.parse(xsd_path))

xml = b'''<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.08">
    <CstmrDrctDbtInitn>
        <GrpHdr>
            <MsgId>BMS-123</MsgId>
            <CreDtTm>2026-06-13T12:00:00Z</CreDtTm>
            <NbOfTxs>1</NbOfTxs>
            <CtrlSum>100</CtrlSum>
            <InitgPty>
                <Id>
                    <OrgId>
                        <Othr>
                            <Id>123</Id>
                            <SchmeNm>
                                <Cd>CUST</Cd>
                                <Prtry>SEPA</Prtry>
                            </SchmeNm>
                        </Othr>
                    </OrgId>
                </Id>
            </InitgPty>
        </GrpHdr>
        <PmtInf>
            <PmtInfId>PMT-1</PmtInfId>
            <PmtMtd>DD</PmtMtd>
            <ReqdColltnDt>2026-06-13</ReqdColltnDt>
            <Cdtr>
                <Nm>Creditor</Nm>
            </Cdtr>
            <CdtrAcct>
                <Id><IBAN>GB12345678901234567890</IBAN></Id>
            </CdtrAcct>
            <CdtrAgt>
                <FinInstnId><BICFI>ABCDEFGH</BICFI></FinInstnId>
            </CdtrAgt>
            <CdtrSchmeId><Id><PrvtId><Othr><Id>1</Id><SchmeNm><Prtry>SEPA</Prtry></SchmeNm></Othr></PrvtId></Id></CdtrSchmeId>
            <DrctDbtTxInf>
                <PmtId><EndToEndId>E2E</EndToEndId></PmtId>
                <InstdAmt Ccy="GBP">100</InstdAmt>
                <DrctDbtTx><MndtRltdInf><MndtId>1</MndtId><DtOfSgntr>2026-06-13</DtOfSgntr></MndtRltdInf></DrctDbtTx>
                <DbtrAgt><FinInstnId><BICFI>ABCDEFGH</BICFI></FinInstnId></DbtrAgt>
                <Dbtr><Nm>Dbtr</Nm></Dbtr>
                <DbtrAcct><Id><IBAN>GB12345678901234567890</IBAN></Id></DbtrAcct>
            </DrctDbtTxInf>
        </PmtInf>
    </CstmrDrctDbtInitn>
</Document>'''

try:
    schema.assertValid(etree.fromstring(xml))
except Exception as e:
    print("XSD Error:")
    print(str(e))

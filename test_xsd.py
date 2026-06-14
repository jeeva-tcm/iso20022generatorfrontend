from lxml import etree
import io

xsd = b'''<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
    <xs:element name="Doc">
        <xs:complexType>
            <xs:sequence>
                <xs:element name="SchmeNm">
                    <xs:complexType>
                        <xs:choice>
                            <xs:element name="Cd">
                                <xs:simpleType>
                                    <xs:restriction base="xs:string">
                                        <xs:enumeration value="BANK"/>
                                        <xs:enumeration value="CUST"/>
                                    </xs:restriction>
                                </xs:simpleType>
                            </xs:element>
                            <xs:element name="Prtry" type="xs:string"/>
                        </xs:choice>
                    </xs:complexType>
                </xs:element>
            </xs:sequence>
        </xs:complexType>
    </xs:element>
</xs:schema>'''

schema = etree.XMLSchema(etree.parse(io.BytesIO(xsd)))

xml = b'''<?xml version="1.0" encoding="UTF-8"?>
<Doc>
    <SchmeNm>
        <Cd>VAT</Cd>
    </SchmeNm>
</Doc>'''

try:
    schema.assertValid(etree.parse(io.BytesIO(xml)))
    print('Valid!')
except Exception as e:
    print(str(e))

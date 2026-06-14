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
                            <xs:element name="Cd" type="xs:string"/>
                            <xs:element name="Prtry" type="xs:string"/>
                        </xs:choice>
                    </xs:complexType>
                </xs:element>
                <xs:element name="Issr" type="xs:string" minOccurs="1"/>
            </xs:sequence>
        </xs:complexType>
    </xs:element>
</xs:schema>'''

schema = etree.XMLSchema(etree.parse(io.BytesIO(xsd)))

import re
def check(xml):
    try:
        schema.assertValid(etree.parse(io.BytesIO(xml.encode('utf-8'))))
    except Exception as e:
        print(str(e))

check('<Doc><SchmeNm><Cd>A</Cd><Cd>B</Cd></SchmeNm><Issr>X</Issr></Doc>')

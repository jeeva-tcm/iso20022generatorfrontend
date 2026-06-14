from lxml import etree
import io

xsd = b'''<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" targetNamespace="ns1" elementFormDefault="qualified">
    <xs:element name="Doc">
        <xs:complexType>
            <xs:sequence>
                <xs:element name="Tp">
                    <xs:complexType>
                        <xs:choice>
                            <xs:element name="Cd" type="xs:string"/>
                            <xs:element name="Prtry" type="xs:string"/>
                        </xs:choice>
                    </xs:complexType>
                </xs:element>
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
        print("XML:", xml)
        print("Err:", str(e))
        print()

check('<Doc xmlns="ns1"><Tp><Cd xmlns="">A</Cd></Tp></Doc>')

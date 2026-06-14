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
                <xs:element name="Issr" type="xs:string" minOccurs="0"/>
            </xs:sequence>
        </xs:complexType>
    </xs:element>
</xs:schema>'''

schema = etree.XMLSchema(etree.parse(io.BytesIO(xsd)))

import re
def parse_xsd_error(msg):
    if 'not expected' in msg:
        m = re.search(r"Element '(?:\{[^}]+\})?([^']+)'.*?Expected is(?: one of)? \(\s*([^)]+)\s*\)", msg)
        if m:
            found_elem = m.group(1).strip()
            expected_str = m.group(2)
            all_expected = [t.strip().strip('()').split('}')[-1] for t in expected_str.split(',')]
            if found_elem in ['Cd', 'Prtry'] and ('Cd' in all_expected or 'Prtry' in all_expected):
                return '/OrgId/Othr Mutually exclusive elements conflict'
            return f"Found '{found_elem}', Expected {all_expected}"
    return "No match"

def check(xml):
    print("Testing:", xml.replace('\n', ''))
    try:
        schema.assertValid(etree.parse(io.BytesIO(xml.encode('utf-8'))))
        print('Valid!\n')
    except Exception as e:
        err = str(e)
        print("XSD Error:", err)
        print("Parser Output:", parse_xsd_error(err))
        print()

check('<Doc><SchmeNm><Cd>A</Cd><Prtry>B</Prtry></SchmeNm></Doc>')
check('<Doc><SchmeNm><Prtry>B</Prtry><Cd>A</Cd></SchmeNm></Doc>')
check('<Doc><SchmeNm></SchmeNm></Doc>')
check('<Doc><SchmeNm><Cd>A</Cd></SchmeNm></Doc>')
check('<Doc><SchmeNm><Cd>A</Cd><Cd>B</Cd></SchmeNm></Doc>')

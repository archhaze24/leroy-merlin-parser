from selenium import webdriver
from time import sleep


def get_qrator_key():
    options = webdriver.ChromeOptions()
    options.add_argument(
        "user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 "
        "Safari/537.36"
    )
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--headless")

    driver = webdriver.Chrome(options=options)
    driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
        'source': '''
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
    '''
    })

    try:
        driver.get(url='https://lemanapro.ru/')
        sleep(3)
        qrator_jsid = driver.get_cookie('qrator_jsid')['value']
        return qrator_jsid
    except Exception as ex:
        raise ex
    finally:
        driver.close()
        driver.quit()

qrator_jsid = get_qrator_key()
print(qrator_jsid)